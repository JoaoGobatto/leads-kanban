import Image from 'next/image'

function initials(name: string | null, phone: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return phone.slice(-2)
}

// Cor estável derivada do texto — mesmo lead sempre tem a mesma cor (paleta neon).
function colorFrom(seed: string): string {
  const palette = ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#f87171']
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export default function Avatar({
  name,
  phone,
  photoUrl,
}: {
  name: string | null
  phone: string
  photoUrl: string | null
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name ?? phone}
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/15"
      />
    )
  }
  const color = colorFrom(name ?? phone)
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black/80 ring-1 ring-white/15"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
        boxShadow: `0 0 14px -2px ${color}80`,
      }}
    >
      {initials(name, phone)}
    </div>
  )
}
