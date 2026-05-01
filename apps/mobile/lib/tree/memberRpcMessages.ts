/** Lời thoại Việt cho RPC claim/unlink (khớp web `treeTypes`). */
export function claimRpcErrorVi(code: string | undefined): string {
  switch (code) {
    case 'unauthorized':
      return 'Bạn cần đăng nhập.'
    case 'forbidden':
      return 'Bạn không thuộc dòng họ này — không thể liên kết.'
    case 'not_found':
      return 'Không tìm thấy thành viên.'
    case 'already_linked':
      return 'Node này đã liên kết với một tài khoản khác.'
    case 'already_claimed_other':
      return 'Bạn đã liên kết với một người khác trong cây này.'
    default:
      return 'Không thực hiện được.'
  }
}
