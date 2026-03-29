"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Key, ExternalLink, Sparkles, Info, Eye, EyeOff } from "lucide-react"
import Link from "next/link"

interface ApiKeySetupProps {
  onApiKeySet: (apiKey: string) => void
  currentApiKey?: string
}

export default function ApiKeySetup({ onApiKeySet, currentApiKey }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState(currentApiKey || "")
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return

    setIsValidating(true)

    // Simple validation - just check if it looks like a Groq API key
    if (apiKey.startsWith("gsk_")) {
      onApiKeySet(apiKey.trim())
    } else {
      alert("Please enter a valid Groq API key (should start with 'gsk_')")
    }

    setIsValidating(false)
  }

  const handleClear = () => {
    setApiKey("")
    onApiKeySet("")
  }

  return (
    <Card className="border-2 border-purple-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardTitle className="text-purple-900 flex items-center gap-2">
          <Key className="h-5 w-5" />
          Groq Cloud API Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-700">
            <strong>Enhanced AI Analysis</strong>
            <p className="mt-1">
              Add your Groq Cloud API key to unlock AI-powered script analysis and precise keyword extraction. Groq
              provides fast, high-quality AI processing at competitive rates.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-100 text-purple-800 border border-purple-300">Free Tier Available</Badge>
            <Badge className="bg-green-100 text-green-800 border border-green-300">Fast Processing</Badge>
            <Badge className="bg-blue-100 text-blue-800 border border-blue-300">High Quality</Badge>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              How to get your Groq API key:
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>
                Visit{" "}
                <Link href="https://console.groq.com" target="_blank" className="underline hover:text-blue-600">
                  console.groq.com
                </Link>
              </li>
              <li>Sign up for a free account</li>
              <li>Navigate to API Keys section</li>
              <li>Create a new API key</li>
              <li>Copy and paste it below</li>
            </ol>
            <div className="mt-3">
              <Link
                href="https://console.groq.com"
                target="_blank"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Open Groq Console <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="groq-api-key" className="text-sm font-semibold text-purple-900">
              Groq API Key
            </label>
            <div className="relative">
              <Input
                id="groq-api-key"
                type={showKey ? "text" : "password"}
                placeholder="gsk_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="border-2 border-purple-200 focus:border-purple-500 focus:ring-purple-500 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={!apiKey.trim() || isValidating}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isValidating ? "Validating..." : currentApiKey ? "Update API Key" : "Set API Key"}
            </Button>
            {currentApiKey && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                Clear
              </Button>
            )}
          </div>
        </form>

        {currentApiKey && (
          <Alert className="border-green-200 bg-green-50">
            <Sparkles className="h-4 w-4" />
            <AlertDescription className="text-green-800">
              ✓ Groq API key configured! You'll get AI-powered script analysis and keyword extraction.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-600 space-y-1">
          <p>• Your API key is stored locally in your browser and never sent to our servers</p>
          <p>• API calls are made directly from your browser to Groq Cloud</p>
          <p>• You can remove your API key at any time</p>
        </div>
      </CardContent>
    </Card>
  )
}
