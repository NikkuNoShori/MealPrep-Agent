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
    PostgrestVersion: "14.1"
  }
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
      chat_conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          metadata: Json | null
          selected_intent: string | null
          session_id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          selected_intent?: string | null
          session_id: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          selected_intent?: string | null
          session_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          message_type: string | null
          metadata: Json | null
          sender: string
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          sender: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          sender?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_recipes: {
        Row: {
          added_at: string | null
          collection_id: string
          recipe_id: string
          sort_order: number | null
        }
        Insert: {
          added_at?: string | null
          collection_id: string
          recipe_id: string
          sort_order?: number | null
        }
        Update: {
          added_at?: string | null
          collection_id?: string
          recipe_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_recipes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "recipe_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          age: number | null
          allergies: string[] | null
          created_at: string | null
          dietary_restrictions: string[] | null
          household_id: string
          id: string
          is_active: boolean | null
          managed_by: string | null
          name: string
          preferences: Json | null
          relationship: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          allergies?: string[] | null
          created_at?: string | null
          dietary_restrictions?: string[] | null
          household_id: string
          id?: string
          is_active?: boolean | null
          managed_by?: string | null
          name: string
          preferences?: Json | null
          relationship?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          allergies?: string[] | null
          created_at?: string | null
          dietary_restrictions?: string[] | null
          household_id?: string
          id?: string
          is_active?: boolean | null
          managed_by?: string | null
          name?: string
          preferences?: Json | null
          relationship?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_managed_by_fkey"
            columns: ["managed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          created_at: string | null
          expires_at: string | null
          household_id: string
          id: string
          invited_by: string
          invited_email: string
          inviter_name: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          household_id: string
          id?: string
          invited_by: string
          invited_email: string
          inviter_name?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          household_id?: string
          id?: string
          invited_by?: string
          invited_email?: string
          inviter_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          category: string | null
          common_names: string[] | null
          created_at: string | null
          id: string
          is_common: boolean | null
          name: string
          nutrition_info: Json | null
          subcategory: string | null
          typical_price: number | null
          typical_unit: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          common_names?: string[] | null
          created_at?: string | null
          id?: string
          is_common?: boolean | null
          name: string
          nutrition_info?: Json | null
          subcategory?: string | null
          typical_price?: number | null
          typical_unit?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          common_names?: string[] | null
          created_at?: string | null
          id?: string
          is_common?: boolean | null
          name?: string
          nutrition_info?: Json | null
          subcategory?: string | null
          typical_price?: number | null
          typical_unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          copied_from: string | null
          created_at: string | null
          created_by: string | null
          end_date: string
          grocery_list: Json | null
          id: string
          last_edited_by: string | null
          meals: Json
          notes: string | null
          start_date: string
          status: string | null
          title: string | null
          total_cost: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          copied_from?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date: string
          grocery_list?: Json | null
          id?: string
          last_edited_by?: string | null
          meals: Json
          notes?: string | null
          start_date: string
          status?: string | null
          title?: string | null
          total_cost?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          copied_from?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          grocery_list?: Json | null
          id?: string
          last_edited_by?: string | null
          meals?: Json
          notes?: string | null
          start_date?: string
          status?: string | null
          title?: string | null
          total_cost?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_copied_from_fkey"
            columns: ["copied_from"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string
          email: string
          first_name: string | null
          household_size: number | null
          id: string
          last_name: string | null
          setup_completed: boolean
          timezone: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name: string
          email: string
          first_name?: string | null
          household_size?: number | null
          id: string
          last_name?: string | null
          setup_completed?: boolean
          timezone?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string
          email?: string
          first_name?: string | null
          household_size?: number | null
          id?: string
          last_name?: string | null
          setup_completed?: boolean
          timezone?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      recipe_collections: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_embeddings: {
        Row: {
          created_at: string | null
          embedding: string | null
          embedding_type: string | null
          id: string
          recipe_id: string
          text_content: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          embedding_type?: string | null
          id?: string
          recipe_id: string
          text_content: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          embedding_type?: string | null
          id?: string
          recipe_id?: string
          text_content?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_embeddings_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_reactions: {
        Row: {
          created_at: string
          family_member_id: string | null
          id: string
          reaction: string
          recipe_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          family_member_id?: string | null
          id?: string
          reaction: string
          recipe_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          family_member_id?: string | null
          id?: string
          reaction?: string
          recipe_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_reactions_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_reactions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cook_time: number | null
          created_at: string | null
          cuisine: string | null
          description: string | null
          dietary_tags: string[] | null
          difficulty: string | null
          embedding_vector: string | null
          id: string
          image_url: string | null
          ingredients: Json
          instructions: Json
          is_favorite: boolean | null
          nutrition_info: Json | null
          prep_time: number | null
          rating: number | null
          searchable_text: string | null
          servings: number | null
          slug: string | null
          source_name: string | null
          source_url: string | null
          tags: string[] | null
          title: string
          total_time: number | null
          updated_at: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          cook_time?: number | null
          created_at?: string | null
          cuisine?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          difficulty?: string | null
          embedding_vector?: string | null
          id?: string
          image_url?: string | null
          ingredients: Json
          instructions: Json
          is_favorite?: boolean | null
          nutrition_info?: Json | null
          prep_time?: number | null
          rating?: number | null
          searchable_text?: string | null
          servings?: number | null
          slug?: string | null
          source_name?: string | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          total_time?: number | null
          updated_at?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          cook_time?: number | null
          created_at?: string | null
          cuisine?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          difficulty?: string | null
          embedding_vector?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          instructions?: Json
          is_favorite?: boolean | null
          nutrition_info?: Json | null
          prep_time?: number | null
          rating?: number | null
          searchable_text?: string | null
          servings?: number | null
          slug?: string | null
          source_name?: string | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          total_time?: number | null
          updated_at?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          measurement_system: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          measurement_system?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          measurement_system?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_similar_recipes: {
        Args: {
          max_results?: number
          recipe_id: string
          similarity_threshold?: number
          user_id: string
        }
        Returns: {
          cook_time: number
          created_at: string
          description: string
          difficulty: string
          id: string
          image_url: string
          ingredients: Json
          instructions: Json
          is_public: boolean
          prep_time: number
          rating: number
          searchable_text: string
          servings: number
          similarity_score: number
          source_url: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      get_household_recipes: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_household_role: {
        Args: { p_household_id: string; p_user_id: string }
        Returns: string
      }
      get_my_household: { Args: never; Returns: Json }
      get_my_pending_invites: { Args: never; Returns: Json }
      get_recipe_reactions: { Args: { p_recipe_ids: string[] }; Returns: Json }
      get_recipe_recommendations: {
        Args: {
          limit_count?: number
          max_prep_time_minutes?: number
          preference_difficulty?: string
          preference_tags?: string[]
          user_id: string
        }
        Returns: {
          cook_time: number
          created_at: string
          description: string
          difficulty: string
          id: string
          image_url: string
          ingredients: Json
          instructions: Json
          is_public: boolean
          prep_time: number
          rating: number
          recommendation_score: number
          searchable_text: string
          servings: number
          source_url: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_household_member: {
        Args: { p_household_id: string; p_user_id: string }
        Returns: boolean
      }
      search_recipes_by_ingredients: {
        Args: {
          ingredient_list: string[]
          match_count?: number
          match_threshold?: number
          user_id: string
        }
        Returns: {
          cook_time: number
          created_at: string
          description: string
          difficulty: string
          id: string
          image_url: string
          ingredient_match_score: number
          ingredients: Json
          instructions: Json
          is_public: boolean
          prep_time: number
          rating: number
          searchable_text: string
          servings: number
          source_url: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      search_recipes_semantic: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          user_id: string
        }
        Returns: {
          cook_time: number
          created_at: string
          description: string
          difficulty: string
          id: string
          image_url: string
          ingredients: Json
          instructions: Json
          is_public: boolean
          prep_time: number
          rating: number
          searchable_text: string
          servings: number
          similarity_score: number
          source_url: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      search_recipes_text: {
        Args: { max_results?: number; search_query: string; user_uuid: string }
        Returns: {
          description: string
          ingredients: Json
          instructions: Json
          rank_score: number
          recipe_id: string
          title: string
        }[]
      }
      search_similar_recipes: {
        Args: {
          max_results?: number
          query_embedding: string
          similarity_threshold?: number
          user_uuid: string
        }
        Returns: {
          description: string
          ingredients: Json
          instructions: Json
          recipe_id: string
          similarity_score: number
          title: string
        }[]
      }
      set_user_id: { Args: { user_uuid: string }; Returns: undefined }
      toggle_recipe_reaction: {
        Args: {
          p_family_member_id?: string
          p_reaction: string
          p_recipe_id: string
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
