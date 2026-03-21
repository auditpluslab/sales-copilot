import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import { CreateSessionSchema, UpdateSessionSchema } from "@/lib/validators/session"
import { sanitizeInput, isSafeSqlInput } from "@/lib/security/sanitizer"
import type { Session } from "@/types"

// GET /api/session - セッション一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const limitParam = searchParams.get("limit")

    // limitパラメータのバリデーション
    let limit = 20
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
        return NextResponse.json(
          { error: "Invalid limit parameter. Must be between 1 and 1000" },
          { status: 400 }
        )
      }
      limit = parsedLimit
    }

    // statusパラメータのサニタイズ
    const sanitizedStatus = status ? sanitizeInput(status, { maxLength: 50 }) : null

    let query = supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (sanitizedStatus) {
      query = query.eq("status", sanitizedStatus)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sessions: data })
  } catch (error) {
    console.error("Failed to fetch sessions:", error)
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    )
  }
}

// POST /api/session - 新規セッション作成
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()

    // 入力バリデーション
    const validationResult = CreateSessionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data

    // 追加のサニタイズ
    const sanitizedData = {
      client_name: sanitizeInput(validatedData.client_name, { maxLength: 100 }),
      client_company: validatedData.client_company
        ? sanitizeInput(validatedData.client_company, { maxLength: 100 })
        : null,
      meeting_title: sanitizeInput(validatedData.meeting_title, { maxLength: 200 }),
      meeting_date: validatedData.meeting_date || new Date().toISOString(),
      notes: validatedData.notes
        ? sanitizeInput(validatedData.notes, { maxLength: 10000 })
        : null,
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        client_name: sanitizedData.client_name,
        client_company: sanitizedData.client_company,
        meeting_title: sanitizedData.meeting_title,
        meeting_date: sanitizedData.meeting_date,
        status: "scheduled",
        notes: sanitizedData.notes,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ session: data })
  } catch (error) {
    console.error("Failed to create session:", error)
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    )
  }
}

// PATCH /api/session - セッション更新
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()

    // 入力バリデーション
    const validationResult = UpdateSessionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data
    const { id, ...updates } = validatedData

    // 追加のサニタイズ
    const sanitizedUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.client_name) {
      sanitizedUpdates.client_name = sanitizeInput(updates.client_name, { maxLength: 100 })
    }
    if (updates.client_company) {
      sanitizedUpdates.client_company = sanitizeInput(updates.client_company, { maxLength: 100 })
    }
    if (updates.meeting_title) {
      sanitizedUpdates.meeting_title = sanitizeInput(updates.meeting_title, { maxLength: 200 })
    }
    if (updates.notes) {
      sanitizedUpdates.notes = sanitizeInput(updates.notes, { maxLength: 10000 })
    }
    if (updates.status) {
      sanitizedUpdates.status = updates.status
    }
    if (updates.meeting_date) {
      sanitizedUpdates.meeting_date = updates.meeting_date
    }

    const { data, error } = await supabase
      .from("sessions")
      .update(sanitizedUpdates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ session: data })
  } catch (error) {
    console.error("Failed to update session:", error)
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    )
  }
}

// DELETE /api/session - セッション削除
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      )
    }

    // UUIDバリデーション
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid session ID format" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete session:", error)
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    )
  }
}
