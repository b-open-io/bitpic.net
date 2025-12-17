"use client"

import { useState } from "react"
import Image from "next/image"
import { Copy, Check } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface AvatarCardProps {
  paymail: string
  imageUrl: string
  timestamp: string
}

export function AvatarCard({ paymail, imageUrl, timestamp }: AvatarCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(paymail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const truncatePaymail = (email: string) => {
    const [user, domain] = email.split("@")
    if (user.length > 12) {
      return `${user.slice(0, 6)}...${user.slice(-4)}@${domain}`
    }
    return email
  }

  return (
    <Card
      className="group relative overflow-hidden border-border transition-all hover:border-primary hover:shadow-md cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">
        <div className="aspect-square relative overflow-hidden bg-muted">
          <Image
            src={imageUrl}
            alt={`Avatar for ${paymail}`}
            fill
            className="object-cover transition-all duration-300 grayscale group-hover:grayscale-0 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          {/* Copy button overlay */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopy()
                }}
                className="opacity-90 hover:opacity-100"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-1 p-3">
        <p className="font-mono text-xs text-foreground truncate w-full">
          {truncatePaymail(paymail)}
        </p>
        <p className="text-xs text-muted-foreground">{timestamp}</p>
      </CardFooter>
    </Card>
  )
}
