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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      genres: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      movie_cast: {
        Row: {
          billing_order: number | null
          character: string | null
          movie_id: number
          person_id: number
        }
        Insert: {
          billing_order?: number | null
          character?: string | null
          movie_id: number
          person_id: number
        }
        Update: {
          billing_order?: number | null
          character?: string | null
          movie_id?: number
          person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "movie_cast_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_cast_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_crew: {
        Row: {
          job: string
          movie_id: number
          person_id: number
        }
        Insert: {
          job: string
          movie_id: number
          person_id: number
        }
        Update: {
          job?: string
          movie_id?: number
          person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "movie_crew_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_crew_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_genres: {
        Row: {
          genre_id: number
          movie_id: number
        }
        Insert: {
          genre_id: number
          movie_id: number
        }
        Update: {
          genre_id?: number
          movie_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "movie_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_genres_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      movies: {
        Row: {
          id: number
          language: string | null
          original_title: string | null
          overview: string | null
          playable_url: string | null
          popularity: number | null
          poster_path: string | null
          rating: number | null
          runtime: number | null
          title: string
          year: number | null
        }
        Insert: {
          id: number
          language?: string | null
          original_title?: string | null
          overview?: string | null
          playable_url?: string | null
          popularity?: number | null
          poster_path?: string | null
          rating?: number | null
          runtime?: number | null
          title: string
          year?: number | null
        }
        Update: {
          id?: number
          language?: string | null
          original_title?: string | null
          overview?: string | null
          playable_url?: string | null
          popularity?: number | null
          poster_path?: string | null
          rating?: number | null
          runtime?: number | null
          title?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movies_language_fkey"
            columns: ["language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      people: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          code: string
          control_mode: string
          created_at: string
          host_session: string
          locked: boolean
          movie_id: number | null
          playing: boolean
          position_at_ref: number
          server_ref_time: number
          theme: string
          version: number
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          code: string
          control_mode?: string
          created_at?: string
          host_session: string
          locked?: boolean
          movie_id?: number | null
          playing?: boolean
          position_at_ref?: number
          server_ref_time?: number
          theme?: string
          version?: number
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          code?: string
          control_mode?: string
          created_at?: string
          host_session?: string
          locked?: boolean
          movie_id?: number | null
          playing?: boolean
          position_at_ref?: number
          server_ref_time?: number
          theme?: string
          version?: number
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_room: {
        Args: {
          p_movie_id?: number
          p_session: string
          p_theme: string
          p_video_title: string
          p_video_url: string
        }
        Returns: Json
      }
      fuzzy_name_match: {
        Args: { p_name: string; p_query: string }
        Returns: boolean
      }
      get_room: { Args: { p_code: string }; Returns: Json }
      movie_card: {
        Args: { m: Database["public"]["Tables"]["movies"]["Row"] }
        Returns: Json
      }
      movie_facets: { Args: never; Returns: Json }
      room_admin: {
        Args: {
          p_action: string
          p_code: string
          p_session: string
          p_target?: string
          p_value?: string
        }
        Returns: Json
      }
      room_command: {
        Args: {
          p_action: string
          p_code: string
          p_movie_id?: number
          p_position?: number
          p_session: string
          p_version: number
          p_video_title?: string
          p_video_url?: string
        }
        Returns: Json
      }
      room_json: {
        Args: {
          applied: boolean
          r: Database["public"]["Tables"]["rooms"]["Row"]
        }
        Returns: Json
      }
      search_movies: {
        Args: {
          p_actor?: string
          p_director?: string
          p_genre?: string
          p_language?: string
          p_max_runtime?: number
          p_min_rating?: number
          p_page?: number
          p_page_size?: number
          p_sort?: string
          p_year_from?: number
          p_year_to?: number
          q?: string
        }
        Returns: Json
      }
      search_people: { Args: { p_role?: string; q: string }; Returns: Json }
      server_ms: { Args: never; Returns: number }
      similar_movies: { Args: { p_id: number }; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
