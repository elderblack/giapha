declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getLunar(): Lunar
  }

  export class Lunar {
    getYear(): number
    /** Âm: có thể âm khi là tháng nhuận */
    getMonth(): number
    getDay(): number
    getYearInGanZhi(): string
    getShengxiao(): string
  }
}
