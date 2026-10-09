import type { ExpSection } from './types'
export function calcSection(s: ExpSection, rules: { hoursPerFte: number; benefitsRate: number; goodsPerFte: number; equipmentPerFte: number }) {
  return s.hours.map((h, yi) => {
    const fte = h / rules.hoursPerFte
    const salaries = fte * s.salary
    const benefits = salaries * (s.benefitsOverride ?? rules.benefitsRate)
    const goods = fte * rules.goodsPerFte + (yi === 0 ? s.goods : 0)
    const equipment = fte * rules.equipmentPerFte + (yi === 0 ? s.equipment : 0)
    return { fte, salaries, benefits, goods, equipment, total: salaries + benefits + goods + equipment }
  })
}
