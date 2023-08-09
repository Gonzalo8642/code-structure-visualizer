import Link from 'next/link'
import type { InferGetStaticPropsType } from 'next'
import type { Repository } from '../types/github'

export async function getStaticProps() {
  const next = await fetch('https://api.github.com/repos/vercel/next.js')
  const react = await fetch('https://api.github.com/facebook/react')
  const nextData: Repository = await next.json()
  const reactData: Repository = await react.json()

  return {
    props: {
      nextStars: nextData.stargazers_count,
      reactStars: reactData.stargazers_count,
    },
  }
}

export default function IndexPage({
  nextStars,
  reactStars
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <p>Next.js has {nextStars} ⭐️</p>
      <p>React has {reactStars} ⭐️</p>
      <Link href="/preact-stars">How about preact?</Link>
    </>
  )
}
