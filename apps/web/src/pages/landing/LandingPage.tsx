import { Features } from './sections/Features'
import { Hero } from './sections/Hero'
import { HowItWorks } from './sections/HowItWorks'
import { Partners } from './sections/Partners'
import { Pricing } from './sections/Pricing'
import { ProblemSolution } from './sections/ProblemSolution'
import { Testimonials } from './sections/Testimonials'
import { Waitlist } from './sections/Waitlist'

export function LandingPage() {
  return (
    <>
      <Hero />
      <Partners />
      <ProblemSolution />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <Waitlist />
    </>
  )
}
