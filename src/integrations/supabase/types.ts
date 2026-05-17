export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bets: {
        Row: {
          game_id: string
          id: string
          odds_id: string
          placed_at: string
          potential_payout: number
          price: number
          selection_label: string
          settled_at: string | null
          stake: number
          status: string
          user_id: string
        }
        Insert: {
          game_id: string
          id?: string
          odds_id: string
          placed_at?: string
          potential_payout: number
          price: number
          selection_label: string
          settled_at?: string | null
          stake: number
          status?: string
          user_id: string
        }
        Update: {
          game_id?: string
          id?: string
          odds_id?: string
          placed_at?: string
          potential_payout?: number
          price?: number
          selection_label?: string
          settled_at?: string | null
          stake?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_odds_id_fkey"
            columns: ["odds_id"]
            isOneToOne: false
            referencedRelation: "odds"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          away_logo_url: string | null
          away_team: string
          created_at: string
          home_logo_url: string | null
          home_team: string
          id: string
          league: string
          sport: string
          start_time: string
          status: string
          winner: string | null
        }
        Insert: {
          away_logo_url?: string | null
          away_team: string
          created_at?: string
          home_logo_url?: string | null
          home_team: string
          id?: string
          league: string
          sport: string
          start_time: string
          status?: string
          winner?: string | null
        }
        Update: {
          away_logo_url?: string | null
          away_team?: string
          created_at?: string
          home_logo_url?: string | null
          home_team?: string
          id?: string
          league?: string
          sport?: string
          start_time?: string
          status?: string
          winner?: string | null
        }
        Relationships: []
      }
      odds: {
        Row: {
          created_at: string
          game_id: string
          id: string
          label: string
          market: string
          price: number
          selection: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          label: string
          market: string
          price: number
          selection: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          label?: string
          market?: string
          price?: number
          selection?: string
        }
        Relationships: [
          {
            foreignKeyName: "odds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      parlay_legs: {
        Row: {
          game_id: string
          id: string
          market: string
          odds_id: string
          parlay_id: string
          price: number
          selection: string
          selection_label: string
          settled_at: string | null
          status: string
        }
        Insert: {
          game_id: string
          id?: string
          market: string
          odds_id: string
          parlay_id: string
          price: number
          selection: string
          selection_label: string
          settled_at?: string | null
          status?: string
        }
        Update: {
          game_id?: string
          id?: string
          market?: string
          odds_id?: string
          parlay_id?: string
          price?: number
          selection?: string
          selection_label?: string
          settled_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "parlay_legs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parlay_legs_odds_id_fkey"
            columns: ["odds_id"]
            isOneToOne: false
            referencedRelation: "odds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parlay_legs_parlay_id_fkey"
            columns: ["parlay_id"]
            isOneToOne: false
            referencedRelation: "parlays"
            referencedColumns: ["id"]
          },
        ]
      }
      parlays: {
        Row: {
          combined_decimal_odds: number
          id: string
          placed_at: string
          potential_payout: number
          settled_at: string | null
          stake: number
          status: string
          user_id: string
        }
        Insert: {
          combined_decimal_odds: number
          id?: string
          placed_at?: string
          potential_payout: number
          settled_at?: string | null
          stake: number
          status?: string
          user_id: string
        }
        Update: {
          combined_decimal_odds?: number
          id?: string
          placed_at?: string
          potential_payout?: number
          settled_at?: string | null
          stake?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      american_to_decimal: { Args: { p_price: number }; Returns: number }
      finalize_game: { Args: { p_game_id: string }; Returns: Json }
      place_bet: {
        Args: { p_odds_id: string; p_stake: number }
        Returns: string
      }
      place_parlay: {
        Args: { p_odds_ids: string[]; p_stake: number }
        Returns: string
      }
      settle_bet: {
        Args: { p_bet_id: string; p_outcome: string }
        Returns: undefined
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
  public: {
    Enums: {},
  },
} as const
