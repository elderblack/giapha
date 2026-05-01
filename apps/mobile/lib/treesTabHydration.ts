/** Lần tải nội dung tab Dòng họ — tránh skeleton lặp khi đổi tab (timeout không huỷ khi blur). */
let treesTabContentHydrated = false

export function isTreesTabContentHydrated() {
  return treesTabContentHydrated
}

export function markTreesTabContentHydrated() {
  treesTabContentHydrated = true
}

export function resetTreesTabHydrationForTests() {
  treesTabContentHydrated = false
}
