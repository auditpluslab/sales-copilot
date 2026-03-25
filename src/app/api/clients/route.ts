import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import { sanitizeInput } from "@/lib/security/sanitizer"
import { getUserId } from "@/lib/auth-server"
import type { Client } from "@/types"

// GET /api/clients - クライアント一覧取得
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get("limit")

    // limitパラメータのバリデーション
    let limit = 50
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 1000) {
        limit = parsedLimit
      }
    }

    // ユーザーのクライアントを取得
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Failed to fetch clients:", error)
      return NextResponse.json(
        { error: "Failed to fetch clients" },
        { status: 500 }
      )
    }

    return NextResponse.json({ clients: data || [] })
  } catch (error) {
    console.error("Failed to fetch clients:", error)
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    )
  }
}

// POST /api/clients - 新規クライアント作成
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, company, industry, company_size, notes } = body

    // 入力バリデーション
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      )
    }

    // 会社サイズの列挙型検証
    if (company_size !== null && company_size !== undefined) {
      const validSizes = ["small", "medium", "large", "enterprise"]
      if (!validSizes.includes(company_size)) {
        return NextResponse.json(
          {
            error: "Invalid company_size. Must be one of: small, medium, large, enterprise",
            valid_values: validSizes
          },
          { status: 400 }
        )
      }
    }

    // サニタイズ
    const sanitizedData = {
      user_id: userId,
      name: sanitizeInput(name, { maxLength: 100 }),
      company: company ? sanitizeInput(company, { maxLength: 100 }) : null,
      industry: industry ? sanitizeInput(industry, { maxLength: 50 }) : null,
      company_size: company_size || null,
      notes: notes ? sanitizeInput(notes, { maxLength: 5000 }) : null,
    }

    const supabase = createClient()

    // 既存のクライアントを確認（名前＋会社の組み合わせ）
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .eq("name", sanitizedData.name)
      .eq("company", sanitizedData.company)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "Client already exists", client: existing },
        { status: 409 }
      )
    }

    // 新規クライアントを作成
    const { data, error } = await supabase
      .from("clients")
      .insert(sanitizedData)
      .select()
      .single()

    if (error) {
      console.error("Failed to create client:", error)
      return NextResponse.json(
        { error: "Failed to create client" },
        { status: 500 }
      )
    }

    return NextResponse.json({ client: data }, { status: 201 })
  } catch (error) {
    console.error("Failed to create client:", error)
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    )
  }
}

// GET /api/clients/[id] - 個別クライアント取得
// これは個別のルートハンドラーとして実装する必要があります
// export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
//   ...
// }
