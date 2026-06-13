export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          changed_fields: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          summary: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changed_fields?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          summary?: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changed_fields?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_books: {
        Row: {
          aliases: Json
          canonical_order: number
          chapter_count: number
          genre: string
          name_en: string
          name_ja: string
          osis: string
          short_name_ja: string
          testament: string
        }
        Insert: {
          aliases?: Json
          canonical_order: number
          chapter_count: number
          genre: string
          name_en: string
          name_ja: string
          osis: string
          short_name_ja: string
          testament: string
        }
        Update: {
          aliases?: Json
          canonical_order?: number
          chapter_count?: number
          genre?: string
          name_en?: string
          name_ja?: string
          osis?: string
          short_name_ja?: string
          testament?: string
        }
        Relationships: []
      }
      display_id_counters: {
        Row: {
          counter: number
          entity: string
          workspace_id: string
          year: number
        }
        Insert: {
          counter?: number
          entity: string
          workspace_id: string
          year: number
        }
        Update: {
          counter?: number
          entity?: string
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "display_id_counters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gatherings: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_id: string
          ends_at: string | null
          id: string
          kind: string
          metadata: Json
          notes: string
          starts_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          venue_id: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_id?: string
          ends_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          notes?: string
          starts_at: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          venue_id?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_id?: string
          ends_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          notes?: string
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          venue_id?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gatherings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gatherings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          role: string
          status: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          role: string
          status?: string
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          role?: string
          status?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deliveries: {
        Row: {
          created_at: string
          delivery_notes: string
          gathering_id: string
          id: string
          message_id: string
          position: number
          speaker_member_id: string | null
          speaker_name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          delivery_notes?: string
          gathering_id: string
          id?: string
          message_id: string
          position?: number
          speaker_member_id?: string | null
          speaker_name?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          delivery_notes?: string
          gathering_id?: string
          id?: string
          message_id?: string
          position?: number
          speaker_member_id?: string | null
          speaker_name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_gathering_id_fkey"
            columns: ["gathering_id"]
            isOneToOne: false
            referencedRelation: "gatherings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_speaker_member_id_fkey"
            columns: ["speaker_member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_passages: {
        Row: {
          book_id: string
          created_at: string
          display_text: string
          end_chapter: number
          end_verse: number | null
          id: string
          message_id: string
          position: number
          role: string
          start_chapter: number
          start_verse: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          display_text: string
          end_chapter: number
          end_verse?: number | null
          id?: string
          message_id: string
          position?: number
          role?: string
          start_chapter: number
          start_verse?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          display_text?: string
          end_chapter?: number
          end_verse?: number | null
          id?: string
          message_id?: string
          position?: number
          role?: string
          start_chapter?: number
          start_verse?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_passages_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["osis"]
          },
          {
            foreignKeyName: "message_passages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_passages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          central_message: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_id: string
          id: string
          metadata: Json
          notes_markdown: string
          outline_markdown: string
          preparation_stage: string
          primary_series_id: string | null
          source_links: Json
          status: string
          summary: string
          title: string
          type: string
          updated_at: string
          updated_by: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          central_message?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_id?: string
          id?: string
          metadata?: Json
          notes_markdown?: string
          outline_markdown?: string
          preparation_stage?: string
          primary_series_id?: string | null
          source_links?: Json
          status?: string
          summary?: string
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          central_message?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_id?: string
          id?: string
          metadata?: Json
          notes_markdown?: string
          outline_markdown?: string
          preparation_stage?: string
          primary_series_id?: string | null
          source_links?: Json
          status?: string
          summary?: string
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_primary_series_id_fkey"
            columns: ["primary_series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      observances: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ends_on: string
          id: string
          kind: string
          metadata: Json
          name: string
          preset_key: string | null
          source: string
          starts_on: string
          updated_at: string
          updated_by: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_on: string
          id?: string
          kind?: string
          metadata?: Json
          name: string
          preset_key?: string | null
          source?: string
          starts_on: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_on?: string
          id?: string
          kind?: string
          metadata?: Json
          name?: string
          preset_key?: string | null
          source?: string
          starts_on?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          id: string
          name: string
          params: Json
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          params?: Json
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          params?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          ends_on: string | null
          goal: string
          id: string
          name: string
          primary_book_id: string | null
          starts_on: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          ends_on?: string | null
          goal?: string
          id?: string
          name: string
          primary_book_id?: string | null
          starts_on?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          ends_on?: string | null
          goal?: string
          id?: string
          name?: string
          primary_book_id?: string | null
          starts_on?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_primary_book_id_fkey"
            columns: ["primary_book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["osis"]
          },
          {
            foreignKeyName: "series_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      series_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          notes: string
          planned_passage_text: string
          position: number
          series_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          notes?: string
          planned_passage_text?: string
          position?: number
          series_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          notes?: string
          planned_passage_text?: string
          position?: number
          series_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_messages_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_elements: {
        Row: {
          assignee: string
          content: string
          created_at: string
          duration_minutes: number | null
          gathering_id: string
          id: string
          metadata: Json
          position: number
          reference: string
          title: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee?: string
          content?: string
          created_at?: string
          duration_minutes?: number | null
          gathering_id: string
          id?: string
          metadata?: Json
          position?: number
          reference?: string
          title?: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee?: string
          content?: string
          created_at?: string
          duration_minutes?: number | null
          gathering_id?: string
          id?: string
          metadata?: Json
          position?: number
          reference?: string
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_elements_gathering_id_fkey"
            columns: ["gathering_id"]
            isOneToOne: false
            referencedRelation: "gatherings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_elements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          notes: string
          updated_at: string
          updated_by: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denomination_preset: string | null
          id: string
          locale: string
          name: string
          settings: Json
          slug: string
          timezone: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denomination_preset?: string | null
          id?: string
          locale?: string
          name: string
          settings?: Json
          slug: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denomination_preset?: string | null
          id?: string
          locale?: string
          name?: string
          settings?: Json
          slug?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      create_workspace: {
        Args: { workspace_name: string; workspace_slug: string }
        Returns: string
      }
      ilike_contains: {
        Args: { haystack: string; needle: string }
        Returns: boolean
      }
      import_ledger_batch: {
        Args: {
          p_batch_id: string
          p_rows: Json
          p_source_file: string
          p_workspace: string
        }
        Returns: Json
      }
      is_active_member: {
        Args: { target_workspace: string }
        Returns: boolean
      }
      member_role: {
        Args: { target_workspace: string }
        Returns: string
      }
      message_analytics: {
        Args: { p_from?: string; p_to?: string; p_workspace: string }
        Returns: Json
      }
      next_display_id: {
        Args: { entity_name: string; prefix: string; target_workspace: string }
        Returns: string
      }
      peek_invitation: {
        Args: { p_token: string }
        Returns: {
          expired: boolean
          role: string
          status: string
          workspace_name: string
        }[]
      }
      search_messages: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_series?: string
          p_speaker?: string
          p_status?: string
          p_text?: string
          p_type?: string
          p_venue?: string
          p_workspace: string
        }
        Returns: {
          created_at: string
          display_id: string
          id: string
          passages: Json
          preparation_stage: string
          status: string
          title: string
          total_count: number
          type: string
        }[]
      }
      shares_active_workspace: {
        Args: { target_user: string }
        Returns: boolean
      }
      undo_import_batch: {
        Args: { p_batch_id: string; p_workspace: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

