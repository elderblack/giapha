import { Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { role } from '../../design/roles'
import { getSupabase } from '../../lib/supabase'
import { applySpouseLink } from './treeMemberDb'
import { LunarFromSolarButton } from './LunarFromSolarButton'
import {
  membersInDescendantSubtree,
  memberRequestRpcErrorVi,
  type MemberRow,
} from './treeTypes'

type AddMemberModalProps = {
  open: boolean
  onClose: () => void
  treeId: string
  members: MemberRow[] | null
  generations: Map<string, number>
  /** Chủ hoặc biên tập: thêm trực tiếp; nếu false thì biểu mẫu là đề xuất */
  canDirectAdd: boolean
  myLinkedMemberId: string | null
  onSaved: () => void
  /** DB đã có cột family_tree_members.phone (migration). */
  supportsMemberPhoneColumn?: boolean
}

export function AddMemberModal({
  open,
  onClose,
  treeId,
  members,
  generations,
  canDirectAdd,
  myLinkedMemberId,
  onSaved,
  supportsMemberPhoneColumn = true,
}: AddMemberModalProps) {
  const sb = getSupabase()
  const list = useMemo(() => members ?? [], [members])

  const [addName, setAddName] = useState('')
  const [addGender, setAddGender] = useState('')
  const [addBirthDate, setAddBirthDate] = useState('')
  const [addDeathDate, setAddDeathDate] = useState('')
  const [addFatherId, setAddFatherId] = useState('')
  const [addMotherId, setAddMotherId] = useState('')
  const [addSpouseId, setAddSpouseId] = useState('')
  const [addLineageGen, setAddLineageGen] = useState('')
  const [addMemorialReminder, setAddMemorialReminder] = useState(false)
  const [addMemorialUseLunar, setAddMemorialUseLunar] = useState(false)
  const [addMemorialDaysBefore, setAddMemorialDaysBefore] = useState('0')
  const [addBirthLunar, setAddBirthLunar] = useState('')
  const [addDeathLunar, setAddDeathLunar] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  const [proposeKind, setProposeKind] = useState<'spouse' | 'child'>('spouse')
  const [proposeSpouseOfId, setProposeSpouseOfId] = useState('')
  const [proposeParentId, setProposeParentId] = useState('')
  const [proposeParentAs, setProposeParentAs] = useState<'father' | 'mother'>('father')
  const [proposeBusy, setProposeBusy] = useState(false)

  const [err, setErr] = useState<string | null>(null)

  const spouseCandidates = useMemo(() => {
    if (!myLinkedMemberId) return []
    const g = generations.get(myLinkedMemberId)
    if (g === undefined) return []
    return list.filter((m) => m.id !== myLinkedMemberId && generations.get(m.id) === g)
  }, [list, myLinkedMemberId, generations])

  const branchParentCandidates = useMemo(() => {
    if (!myLinkedMemberId) return []
    return membersInDescendantSubtree(list, myLinkedMemberId)
  }, [list, myLinkedMemberId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const spouseSelectValue = useMemo(
    () =>
      proposeSpouseOfId && spouseCandidates.some((m) => m.id === proposeSpouseOfId)
        ? proposeSpouseOfId
        : '',
    [proposeSpouseOfId, spouseCandidates],
  )
  const parentSelectValue = useMemo(
    () =>
      proposeParentId && branchParentCandidates.some((m) => m.id === proposeParentId)
        ? proposeParentId
        : '',
    [proposeParentId, branchParentCandidates],
  )

  async function submitDirect(e: React.FormEvent) {
    e.preventDefault()
    if (!sb || !treeId) return
    setErr(null)
    const name = addName.trim()
    if (name.length < 2) {
      setErr('Tên cần ít nhất 2 ký tự.')
      return
    }
    const lgRaw = addLineageGen.trim()
    let lineage_generation: number | null = null
    if (lgRaw !== '') {
      const n = Number.parseInt(lgRaw, 10)
      if (!Number.isFinite(n) || n < 0) {
        setErr('Đời trong phả phải là số nguyên ≥ 0 hoặc để trống.')
        return
      }
      lineage_generation = n
    }
    const death = addDeathDate.trim() || null
    let memorial_reminder_enabled = false
    let memorial_reminder_use_lunar = false
    let memorial_reminder_days_before = 0
    if (death && addMemorialReminder) {
      memorial_reminder_enabled = true
      memorial_reminder_use_lunar = addMemorialUseLunar
      const dRaw = addMemorialDaysBefore.trim()
      const dn = dRaw === '' ? 0 : Number.parseInt(dRaw, 10)
      if (!Number.isFinite(dn) || dn < 0 || dn > 30) {
        setErr('Nhắc trước ngày giỗ: 0–30 ngày.')
        return
      }
      memorial_reminder_days_before = dn
    }
    setAddBusy(true)
    const { data: inserted, error } = await sb
      .from('family_tree_members')
      .insert({
        family_tree_id: treeId,
        full_name: name,
        gender: addGender || null,
        birth_date: addBirthDate.trim() || null,
        death_date: death,
        birth_lunar_text: addBirthLunar.trim() || null,
        death_lunar_text: addDeathLunar.trim() || null,
        father_id: addFatherId || null,
        mother_id: addMotherId || null,
        lineage_generation,
        memorial_reminder_enabled,
        memorial_reminder_use_lunar,
        memorial_reminder_days_before,
        ...(supportsMemberPhoneColumn ? { phone: addPhone.trim() || null } : {}),
      })
      .select('id')
      .single()
    if (error) {
      setAddBusy(false)
      setErr(error.message)
      return
    }
    if (addSpouseId && inserted?.id) {
      const sp = await applySpouseLink(sb, inserted.id as string, addSpouseId)
      if (sp.error) {
        setAddBusy(false)
        setErr(sp.error)
        return
      }
    }
    setAddBusy(false)
    onSaved()
    onClose()
  }

  async function submitPropose(e: React.FormEvent) {
    e.preventDefault()
    if (!sb || !treeId || !myLinkedMemberId) return
    setErr(null)
    const name = addName.trim()
    if (name.length < 2) {
      setErr('Tên cần ít nhất 2 ký tự.')
      return
    }
    if (proposeKind === 'spouse') {
      if (!spouseSelectValue) {
        setErr('Chọn người làm vợ/chồng.')
        return
      }
    } else {
      if (!parentSelectValue) {
        setErr('Chọn người làm cha hoặc mẹ.')
        return
      }
    }
    setProposeBusy(true)
    const { data, error } = await sb.rpc('submit_family_tree_member_request', {
      p_family_tree_id: treeId,
      p_kind: proposeKind,
      p_spouse_of_member_id: proposeKind === 'spouse' ? spouseSelectValue : null,
      p_child_parent_member_id: proposeKind === 'child' ? parentSelectValue : null,
      p_child_parent_as: proposeKind === 'child' ? proposeParentAs : null,
      p_full_name: name,
      p_gender: addGender || null,
      p_birth_date: addBirthDate.trim() || null,
      p_death_date: addDeathDate.trim() || null,
      p_notes: null,
    })
    setProposeBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    const body = data as { ok?: boolean; error?: string }
    if (!body?.ok) {
      setErr(memberRequestRpcErrorVi(body?.error))
      return
    }
    onSaved()
    onClose()
  }

  if (!open) return null

  const mode: 'direct' | 'propose' = canDirectAdd ? 'direct' : 'propose'

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex min-h-[100dvh] items-start justify-center overflow-y-auto bg-black/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] backdrop-blur-[2px] sm:items-center sm:py-8"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${role.card} relative flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-abnb-xl !p-0 shadow-2xl ring-1 ring-abnb-hairlineSoft/90`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-modal-title"
      >
        <div className="relative shrink-0 border-b border-abnb-hairlineSoft bg-gradient-to-r from-abnb-surfaceSoft/90 to-abnb-canvas/80 px-6 py-5 pr-14">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-2 text-abnb-muted transition-colors hover:bg-abnb-canvas hover:text-abnb-ink"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
          <h3 id="add-member-modal-title" className={`${role.headingModule} text-base`}>
            {mode === 'direct' ? 'Thêm thành viên' : 'Đề xuất thêm người'}
          </h3>
          {mode === 'propose' ? (
            <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
              Chủ dòng hoặc biên tập viên duyệt trước khi hiển thị trên phả hệ.
            </p>
          ) : (
            <p className={`${role.bodySm} mt-2 text-abnb-muted`}>Có thể chỉnh quan hệ sau trong danh sách.</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-6">
        {mode === 'direct' ? (
          <form onSubmit={(e) => void submitDirect(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="modal-m-name" className={`${role.caption} text-abnb-body`}>
                  Họ tên *
                </label>
                <input
                  id="modal-m-name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className={`${role.input} mt-2`}
                  placeholder="Họ và tên"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="modal-m-phone" className={`${role.caption} text-abnb-body`}>
                  Số điện thoại{' '}
                  <span className="font-normal text-abnb-muted">
                    (tuỳ chọn — dùng cấp tài khoản SĐT sau khi đã lưu)
                  </span>
                </label>
                <input
                  id="modal-m-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0912345678"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  className={`${role.input} mt-2`}
                />
                {!supportsMemberPhoneColumn ? (
                  <p className={`${role.caption} mt-2 text-amber-800/90`}>
                    Để <strong>lưu</strong> được SĐT vào hệ thống, cần áp migration có cột phone (chạy{' '}
                    <code className="rounded bg-abnb-surfaceSoft px-1 py-px text-[12px]">supabase db push</code>
                    ). Sau đó tải lại trang và gửi biểu mẫu lại.
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="modal-m-gender" className={`${role.caption} text-abnb-body`}>
                  Giới tính
                </label>
                <select
                  id="modal-m-gender"
                  value={addGender}
                  onChange={(e) => setAddGender(e.target.value)}
                  className={`${role.input} mt-2`}
                >
                  <option value="">—</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label htmlFor="modal-m-birth" className={`${role.caption} text-abnb-body`}>
                  Ngày sinh
                </label>
                <input
                  id="modal-m-birth"
                  type="date"
                  value={addBirthDate}
                  onChange={(e) => setAddBirthDate(e.target.value)}
                  className={`${role.input} mt-2`}
                />
              </div>
              <div>
                <label htmlFor="modal-m-death" className={`${role.caption} text-abnb-body`}>
                  Ngày mất
                </label>
                <input
                  id="modal-m-death"
                  type="date"
                  value={addDeathDate}
                  onChange={(e) => setAddDeathDate(e.target.value)}
                  className={`${role.input} mt-2`}
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="modal-m-bl" className={`${role.caption} text-abnb-body`}>
                    Sinh âm lịch (ghi chú)
                  </label>
                  <LunarFromSolarButton solarIso={addBirthDate} onApply={setAddBirthLunar} />
                </div>
                <input
                  id="modal-m-bl"
                  value={addBirthLunar}
                  onChange={(e) => setAddBirthLunar(e.target.value)}
                  placeholder="Tuỳ chọn — «Từ ngày dương» hoặc ghi tay"
                  className={`${role.input} mt-2`}
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="modal-m-dl" className={`${role.caption} text-abnb-body`}>
                    Mất âm lịch (ghi chú)
                  </label>
                  <LunarFromSolarButton solarIso={addDeathDate} onApply={setAddDeathLunar} />
                </div>
                <input
                  id="modal-m-dl"
                  value={addDeathLunar}
                  onChange={(e) => setAddDeathLunar(e.target.value)}
                  placeholder="Tuỳ chọn — «Từ ngày dương» hoặc ghi tay"
                  className={`${role.input} mt-2`}
                />
              </div>
              <div className="sm:col-span-2 rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-canvas/40 px-4 py-3">
                <label className={`flex cursor-pointer items-start gap-3 ${role.caption} text-abnb-body`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-abnb-hairlineSoft"
                    checked={addMemorialReminder}
                    disabled={!addDeathDate.trim()}
                    onChange={(e) => setAddMemorialReminder(e.target.checked)}
                  />
                  <span>Gửi email nhắc giỗ (kỷ niệm từ ngày mất dương trong hồ sơ).</span>
                </label>
                <label
                  className={`mt-3 flex cursor-pointer items-start gap-3 pl-7 ${role.caption} text-abnb-body`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-abnb-hairlineSoft"
                    checked={addMemorialUseLunar}
                    disabled={!addDeathDate.trim() || !addMemorialReminder}
                    onChange={(e) => setAddMemorialUseLunar(e.target.checked)}
                  />
                  <span>
                    Nhắc theo kỷ niệm <strong>âm lịch</strong> (mặc định tắt = nhắc <strong>dương</strong>).
                  </span>
                </label>
                <div className="mt-3 pl-7">
                  <label htmlFor="modal-m-memdays" className={`${role.caption} text-abnb-body`}>
                    Nhắc trước (ngày)
                  </label>
                  <input
                    id="modal-m-memdays"
                    type="number"
                    min={0}
                    max={30}
                    inputMode="numeric"
                    disabled={!addDeathDate.trim() || !addMemorialReminder}
                    value={addMemorialDaysBefore}
                    onChange={(e) => setAddMemorialDaysBefore(e.target.value.replace(/\D/g, ''))}
                    className={`${role.input} mt-2 max-w-[8rem]`}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="modal-m-lineage" className={`${role.caption} text-abnb-body`}>
                  Đời trong phả <span className="font-normal text-abnb-muted">(tùy chọn)</span>
                </label>
                <input
                  id="modal-m-lineage"
                  inputMode="numeric"
                  value={addLineageGen}
                  onChange={(e) => setAddLineageGen(e.target.value.replace(/\D/g, ''))}
                  className={`${role.input} mt-2`}
                  placeholder="vd. 0 = đời 1, 1 = đời 2…"
                />
                <p className={`${role.bodySm} mt-1.5 text-abnb-muted`}>
                  Dùng khi chưa gắn cha mẹ: tách hàng dọc trên sơ đồ. Có cha/mẹ thì thế hệ vẫn cộng thêm từ quan hệ.
                </p>
              </div>
              <div>
                <label htmlFor="modal-m-father" className={`${role.caption} text-abnb-body`}>
                  Cha (trong cùng dòng họ)
                </label>
                <select
                  id="modal-m-father"
                  value={addFatherId}
                  onChange={(e) => setAddFatherId(e.target.value)}
                  className={`${role.input} mt-2`}
                >
                  <option value="">—</option>
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="modal-m-mother" className={`${role.caption} text-abnb-body`}>
                  Mẹ (trong cùng dòng họ)
                </label>
                <select
                  id="modal-m-mother"
                  value={addMotherId}
                  onChange={(e) => setAddMotherId(e.target.value)}
                  className={`${role.input} mt-2`}
                >
                  <option value="">—</option>
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="modal-m-spouse" className={`${role.caption} text-abnb-body`}>
                  Vợ / chồng (trong cùng dòng họ)
                </label>
                <select
                  id="modal-m-spouse"
                  value={addSpouseId}
                  onChange={(e) => setAddSpouseId(e.target.value)}
                  className={`${role.input} mt-2`}
                >
                  <option value="">—</option>
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {err ? (
              <p className="text-sm text-abnb-error" role="alert">
                {err}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={addBusy}
                className={`${role.btnPrimary} justify-center !rounded-full disabled:opacity-60`}
              >
                {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Thêm'}
              </button>
              <button
                type="button"
                disabled={addBusy}
                onClick={onClose}
                className={`${role.btnSecondary} !rounded-full`}
              >
                Huỷ
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => void submitPropose(e)} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className={`${role.caption} text-abnb-body`}>Loại đề xuất</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="propose-kind"
                  checked={proposeKind === 'spouse'}
                  onChange={() => setProposeKind('spouse')}
                />
                Vợ / chồng (cùng thế hệ với người bạn đã liên kết)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="propose-kind"
                  checked={proposeKind === 'child'}
                  onChange={() => setProposeKind('child')}
                />
                Con / cháu / hậu duệ (cha hoặc mẹ thuộc nhánh của bạn)
              </label>
            </fieldset>

            {proposeKind === 'spouse' ? (
              <div>
                <label htmlFor="modal-spouse-of" className={`${role.caption} text-abnb-body`}>
                  Vợ / chồng với ai *
                </label>
                <select
                  id="modal-spouse-of"
                  value={spouseSelectValue}
                  onChange={(e) => setProposeSpouseOfId(e.target.value)}
                  className={`${role.input} mt-2`}
                  required
                >
                  <option value="">— Chọn —</option>
                  {spouseCandidates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
                {spouseCandidates.length === 0 ? (
                  <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
                    Không có ai cùng thế hệ để ghép vợ/chồng. Có thể cần chủ/biên tập bổ sung người trước.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="modal-child-parent" className={`${role.caption} text-abnb-body`}>
                    Người làm cha hoặc mẹ *
                  </label>
                  <select
                    id="modal-child-parent"
                    value={parentSelectValue}
                    onChange={(e) => setProposeParentId(e.target.value)}
                    className={`${role.input} mt-2`}
                    required
                  >
                    <option value="">— Chọn —</option>
                    {branchParentCandidates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={`${role.caption} text-abnb-body`}>Người được chọn là *</span>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="parent-as"
                        checked={proposeParentAs === 'father'}
                        onChange={() => setProposeParentAs('father')}
                      />
                      Cha
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="parent-as"
                        checked={proposeParentAs === 'mother'}
                        onChange={() => setProposeParentAs('mother')}
                      />
                      Mẹ
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="modal-p-name" className={`${role.caption} text-abnb-body`}>
                  Họ tên người được thêm *
                </label>
                <input
                  id="modal-p-name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className={`${role.input} mt-2`}
                  placeholder="Họ và tên"
                />
              </div>
              <div>
                <label htmlFor="modal-p-gender" className={`${role.caption} text-abnb-body`}>
                  Giới tính
                </label>
                <select
                  id="modal-p-gender"
                  value={addGender}
                  onChange={(e) => setAddGender(e.target.value)}
                  className={`${role.input} mt-2`}
                >
                  <option value="">—</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label htmlFor="modal-p-birth" className={`${role.caption} text-abnb-body`}>
                  Ngày sinh
                </label>
                <input
                  id="modal-p-birth"
                  type="date"
                  value={addBirthDate}
                  onChange={(e) => setAddBirthDate(e.target.value)}
                  className={`${role.input} mt-2`}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="modal-p-death" className={`${role.caption} text-abnb-body`}>
                  Ngày mất
                </label>
                <input
                  id="modal-p-death"
                  type="date"
                  value={addDeathDate}
                  onChange={(e) => setAddDeathDate(e.target.value)}
                  className={`${role.input} mt-2`}
                />
              </div>
            </div>
            {err ? (
              <p className="text-sm text-abnb-error" role="alert">
                {err}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={proposeBusy || (proposeKind === 'spouse' && spouseCandidates.length === 0)}
                className={`${role.btnPrimary} justify-center !rounded-full disabled:opacity-60`}
              >
                {proposeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gửi đề xuất'}
              </button>
              <button
                type="button"
                disabled={proposeBusy}
                onClick={onClose}
                className={`${role.btnSecondary} !rounded-full`}
              >
                Huỷ
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
