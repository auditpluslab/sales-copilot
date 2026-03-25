import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import { sanitizeInput } from "@/lib/security/sanitizer"
import { getUserId } from "@/lib/auth-server"
import { isValidUuid } from "@/lib/security/sanitizer"

interface RouteContext {
  params: {
    id: string
  }
}

// GET /api/clients/[id] - クライアント詳細取得
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const clientId = context.params.id

    if (!isValidUuid(clientId)) {
      return NextResponse.json(
        { error: "Invalid client ID format" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // クライアントを取得（ユーザーが所有しているか確認）
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("user_id", userId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ client: data })
  } catch (error) {
    console.error("Failed to fetch client:", error)
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    )
  }
}

// PATCH /api/clients/[id] - クライアント更新
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const clientId = context.params.id

    if (!isValidUuid(clientId)) {
      return NextResponse.json(
        { error: "Invalid client ID format" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, company, industry, company_size, notes } = body

    // 所有権を確認
    const supabase = createClient()
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("user_id", userId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      )
    }

    // 更新データを構築
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (name) {
      updates.name = sanitizeInput(name, { maxLength: 100 })
    }
    if (company !== undefined) {
      updates.company = company ? sanitizeInput(company, { maxLength: 100 }) : null
    }
    if (industry !== undefined) {
      updates.industry = industry ? sanitizeInput(industry, { maxLength: 50 }) : null
    }
    if (company_size !== undefined) {
      updates.company_size = company_size || null
    }
    if (notes !== undefined) {
      updates.notes = notes ? sanitizeInput(notes, { maxLength: 5000 }) : null
    }

    // 更新
    const { data, error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", clientId)
      .select()
      .single()

    if (error) {
      console.error("Failed to update client:", error)
      return NextResponse.json(
        { error: "Failed to update client" },
        { status: 500 }
      )
    }

    return NextResponse.json({ client: data })
  } catch (error) {
    console.error("Failed to update client:", error)
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    )
  }
}

// DELETE /api/clients/[id] - クライアント削除
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const clientId = context.params.id

    if (!isValidUuid(clientId)) {
      return NextResponse.json(
        { error: "Invalid client ID format" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // 所有権を確認
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("user_id", userId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      )
    }

    // 削除
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)

    if (error) {
      console.error("Failed to delete client:", error)
      return NextResponse.json(
        { error: "Failed to delete client" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete client:", error)
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    )
  }
}
