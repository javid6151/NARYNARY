
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admissions": {
                  Row: {
                    "admission_date": string,"approved_at": string | null,"approved_by": string | null,"bed_id": string,"building_id": string,"created_at": string,"created_by": string,"expected_checkout_date": string | null,"floor_id": string,"id": string,"mess_included": boolean,"monthly_rent": number,"resident_id": string,"review_notes": string | null,"room_id": string,"security_deposit": number,"setup_fee": number,"source": string | null,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admission_date": string,"approved_at"?: string | null,"approved_by"?: string | null,"bed_id": string,"building_id": string,"created_at"?: string,"created_by": string,"expected_checkout_date"?: string | null,"floor_id": string,"id"?: string,"mess_included"?: boolean,"monthly_rent": number,"resident_id": string,"review_notes"?: string | null,"room_id": string,"security_deposit"?: number,"setup_fee"?: number,"source"?: string | null,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "admission_date"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"bed_id"?: string,"building_id"?: string,"created_at"?: string,"created_by"?: string,"expected_checkout_date"?: string | null,"floor_id"?: string,"id"?: string,"mess_included"?: boolean,"monthly_rent"?: number,"resident_id"?: string,"review_notes"?: string | null,"room_id"?: string,"security_deposit"?: number,"setup_fee"?: number,"source"?: string | null,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admissions_building_fk"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "admissions_tenant_id_building_id_bed_id_fkey"
      columns: ["tenant_id","building_id","bed_id"]
isOneToOne: false
      referencedRelation: "beds"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "admissions_tenant_id_building_id_floor_id_fkey"
      columns: ["tenant_id","building_id","floor_id"]
isOneToOne: false
      referencedRelation: "floors"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "admissions_tenant_id_building_id_room_id_fkey"
      columns: ["tenant_id","building_id","room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "admissions_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "admissions_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_type": string,"actor_user_id": string | null,"after_data": Json | null,"before_data": Json | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_type": string,"actor_user_id"?: string | null,"after_data"?: Json | null,"before_data"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"tenant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_type"?: string,"actor_user_id"?: string | null,"after_data"?: Json | null,"before_data"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"beds": {
                  Row: {
                    "bed_label": string,"building_id": string,"created_at": string,"id": string,"room_id": string,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bed_label": string,"building_id": string,"created_at"?: string,"id"?: string,"room_id": string,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "bed_label"?: string,"building_id"?: string,"created_at"?: string,"id"?: string,"room_id"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "beds_tenant_id_building_id_room_id_fkey"
      columns: ["tenant_id","building_id","room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["tenant_id","building_id","id"]
    }
                  ]
                },"building_memberships": {
                  Row: {
                    "building_id": string,"created_at": string,"id": string,"membership_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"created_at"?: string,"id"?: string,"membership_id": string,"tenant_id": string
                  }
                  Update: {
                    "building_id"?: string,"created_at"?: string,"id"?: string,"membership_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "building_memberships_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "tenant_memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "building_memberships_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "building_memberships_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"buildings": {
                  Row: {
                    "address": string | null,"approved_at": string | null,"approved_by": string | null,"city": string | null,"code": string | null,"created_at": string,"created_by": string | null,"id": string,"name": string,"requested_details": NonNullable<Json>,"review_notes": string | null,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"city"?: string | null,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"requested_details"?: NonNullable<Json>,"review_notes"?: string | null,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"city"?: string | null,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"requested_details"?: NonNullable<Json>,"review_notes"?: string | null,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "buildings_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_channel_reads": {
                  Row: {
                    "channel_id": string,"last_read_at": string,"tenant_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"last_read_at"?: string,"tenant_id": string,"user_id": string
                  }
                  Update: {
                    "channel_id"?: string,"last_read_at"?: string,"tenant_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_channel_reads_tenant_id_channel_id_fkey"
      columns: ["tenant_id","channel_id"]
isOneToOne: false
      referencedRelation: "chat_channels"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"chat_channels": {
                  Row: {
                    "building_id": string,"created_at": string,"created_by": string | null,"floor_id": string | null,"id": string,"kind": string,"name": string,"residents_can_post": boolean,"room_id": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"created_at"?: string,"created_by"?: string | null,"floor_id"?: string | null,"id"?: string,"kind": string,"name": string,"residents_can_post"?: boolean,"room_id"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "building_id"?: string,"created_at"?: string,"created_by"?: string | null,"floor_id"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"residents_can_post"?: boolean,"room_id"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_channels_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "body": string,"channel_id": string,"created_at": string,"id": string,"is_pinned": boolean,"sender_is_staff": boolean,"sender_name": string,"sender_user_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"channel_id": string,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"sender_is_staff"?: boolean,"sender_name": string,"sender_user_id": string,"tenant_id": string
                  }
                  Update: {
                    "body"?: string,"channel_id"?: string,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"sender_is_staff"?: boolean,"sender_name"?: string,"sender_user_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_tenant_id_channel_id_fkey"
      columns: ["tenant_id","channel_id"]
isOneToOne: false
      referencedRelation: "chat_channels"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"checkouts": {
                  Row: {
                    "admission_id": string,"checkout_date": string,"created_at": string,"deposit_refund_amount": number,"id": string,"outstanding_amount": number,"processed_by": string,"reason": string | null,"resident_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admission_id": string,"checkout_date": string,"created_at"?: string,"deposit_refund_amount"?: number,"id"?: string,"outstanding_amount"?: number,"processed_by": string,"reason"?: string | null,"resident_id": string,"tenant_id": string
                  }
                  Update: {
                    "admission_id"?: string,"checkout_date"?: string,"created_at"?: string,"deposit_refund_amount"?: number,"id"?: string,"outstanding_amount"?: number,"processed_by"?: string,"reason"?: string | null,"resident_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkouts_tenant_id_admission_id_fkey"
      columns: ["tenant_id","admission_id"]
isOneToOne: false
      referencedRelation: "admissions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "checkouts_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "checkouts_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"community_posts": {
                  Row: {
                    "author_name": string,"body": string,"building_id": string,"closed_at": string | null,"created_at": string,"id": string,"kind": string,"price": number | null,"resident_id": string,"responded_at": string | null,"responded_by": string | null,"staff_response": string | null,"status": string,"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_name": string,"body": string,"building_id": string,"closed_at"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"price"?: number | null,"resident_id": string,"responded_at"?: string | null,"responded_by"?: string | null,"staff_response"?: string | null,"status"?: string,"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_name"?: string,"body"?: string,"building_id"?: string,"closed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"price"?: number | null,"resident_id"?: string,"responded_at"?: string | null,"responded_by"?: string | null,"staff_response"?: string | null,"status"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_posts_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "community_posts_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "community_posts_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"complaints": {
                  Row: {
                    "assigned_membership_id": string | null,"building_id": string,"category": string,"created_at": string,"description": string,"id": string,"priority": string,"resident_id": string,"resolution_notes": string | null,"resolved_at": string | null,"room_id": string | null,"status": string,"submitted_at": string,"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_membership_id"?: string | null,"building_id": string,"category": string,"created_at"?: string,"description": string,"id"?: string,"priority"?: string,"resident_id": string,"resolution_notes"?: string | null,"resolved_at"?: string | null,"room_id"?: string | null,"status"?: string,"submitted_at"?: string,"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_membership_id"?: string | null,"building_id"?: string,"category"?: string,"created_at"?: string,"description"?: string,"id"?: string,"priority"?: string,"resident_id"?: string,"resolution_notes"?: string | null,"resolved_at"?: string | null,"room_id"?: string | null,"status"?: string,"submitted_at"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "complaints_assigned_membership_id_fkey"
      columns: ["assigned_membership_id"]
isOneToOne: false
      referencedRelation: "tenant_memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_room_fk"
      columns: ["tenant_id","building_id","room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "complaints_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "complaints_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "complaints_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"expense_attachments": {
                  Row: {
                    "building_id": string,"created_at": string,"expense_id": string,"file_name": string | null,"id": string,"mime_type": string,"size_bytes": number,"storage_path": string,"tenant_id": string,"uploaded_at": string | null,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"created_at"?: string,"expense_id": string,"file_name"?: string | null,"id"?: string,"mime_type": string,"size_bytes": number,"storage_path": string,"tenant_id": string,"uploaded_at"?: string | null,"uploaded_by": string
                  }
                  Update: {
                    "building_id"?: string,"created_at"?: string,"expense_id"?: string,"file_name"?: string | null,"id"?: string,"mime_type"?: string,"size_bytes"?: number,"storage_path"?: string,"tenant_id"?: string,"uploaded_at"?: string | null,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_attachments_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "expense_attachments_tenant_id_expense_id_fkey"
      columns: ["tenant_id","expense_id"]
isOneToOne: false
      referencedRelation: "expense_balances"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "expense_attachments_tenant_id_expense_id_fkey"
      columns: ["tenant_id","expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "id": string,"is_active": boolean,"is_maintenance": boolean,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"is_maintenance"?: boolean,"name": string,"tenant_id": string
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"is_maintenance"?: boolean,"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_categories_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_payments": {
                  Row: {
                    "amount": number,"created_at": string,"expense_id": string,"id": string,"notes": string | null,"paid_at": string,"payment_method": string,"recorded_by": string,"status": string,"tenant_id": string,"transaction_reference": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"expense_id": string,"id"?: string,"notes"?: string | null,"paid_at": string,"payment_method": string,"recorded_by": string,"status"?: string,"tenant_id": string,"transaction_reference"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"expense_id"?: string,"id"?: string,"notes"?: string | null,"paid_at"?: string,"payment_method"?: string,"recorded_by"?: string,"status"?: string,"tenant_id"?: string,"transaction_reference"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_payments_tenant_id_expense_id_fkey"
      columns: ["tenant_id","expense_id"]
isOneToOne: false
      referencedRelation: "expense_balances"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "expense_payments_tenant_id_expense_id_fkey"
      columns: ["tenant_id","expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "approved_by": string | null,"building_id": string,"category_id": string,"created_at": string,"created_by": string,"description": string | null,"due_date": string | null,"expense_date": string,"floor_id": string | null,"id": string,"room_id": string | null,"source_id": string | null,"source_type": string,"status": string,"subtotal": number,"tax_amount": number,"tenant_id": string,"title": string,"total_amount": number,"updated_at": string,"vendor_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_by"?: string | null,"building_id": string,"category_id": string,"created_at"?: string,"created_by": string,"description"?: string | null,"due_date"?: string | null,"expense_date": string,"floor_id"?: string | null,"id"?: string,"room_id"?: string | null,"source_id"?: string | null,"source_type"?: string,"status"?: string,"subtotal": number,"tax_amount"?: number,"tenant_id": string,"title": string,"total_amount": number,"updated_at"?: string,"vendor_id"?: string | null
                  }
                  Update: {
                    "approved_by"?: string | null,"building_id"?: string,"category_id"?: string,"created_at"?: string,"created_by"?: string,"description"?: string | null,"due_date"?: string | null,"expense_date"?: string,"floor_id"?: string | null,"id"?: string,"room_id"?: string | null,"source_id"?: string | null,"source_type"?: string,"status"?: string,"subtotal"?: number,"tax_amount"?: number,"tenant_id"?: string,"title"?: string,"total_amount"?: number,"updated_at"?: string,"vendor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_floor_fk"
      columns: ["tenant_id","building_id","floor_id"]
isOneToOne: false
      referencedRelation: "floors"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "expenses_room_fk"
      columns: ["tenant_id","building_id","room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "expenses_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "expenses_tenant_id_category_id_fkey"
      columns: ["tenant_id","category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "expenses_tenant_id_vendor_id_fkey"
      columns: ["tenant_id","vendor_id"]
isOneToOne: false
      referencedRelation: "vendors"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"floors": {
                  Row: {
                    "building_id": string,"created_at": string,"floor_number": number,"id": string,"name": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"created_at"?: string,"floor_number": number,"id"?: string,"name"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "building_id"?: string,"created_at"?: string,"floor_number"?: number,"id"?: string,"name"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "floors_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"idempotency_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"key": string,"operation": string,"result": Json | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"key": string,"operation": string,"result"?: Json | null,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"key"?: string,"operation"?: string,"result"?: Json | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "idempotency_keys_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_items": {
                  Row: {
                    "base_unit": string,"category": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"reorder_level": number,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_unit": string,"category"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"reorder_level"?: number,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "base_unit"?: string,"category"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"reorder_level"?: number,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_locations": {
                  Row: {
                    "building_id": string,"id": string,"is_active": boolean,"kind": string,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"id"?: string,"is_active"?: boolean,"kind": string,"name": string,"tenant_id": string
                  }
                  Update: {
                    "building_id"?: string,"id"?: string,"is_active"?: boolean,"kind"?: string,"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_locations_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"inventory_transactions": {
                  Row: {
                    "building_id": string,"created_at": string,"id": string,"inventory_location_id": string,"item_id": string,"notes": string | null,"occurred_at": string,"quantity": number,"recorded_by": string,"reference_id": string | null,"reference_type": string | null,"tenant_id": string,"transaction_type": string,"unit_cost": number | null,"vendor_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"created_at"?: string,"id"?: string,"inventory_location_id": string,"item_id": string,"notes"?: string | null,"occurred_at"?: string,"quantity": number,"recorded_by": string,"reference_id"?: string | null,"reference_type"?: string | null,"tenant_id": string,"transaction_type": string,"unit_cost"?: number | null,"vendor_id"?: string | null
                  }
                  Update: {
                    "building_id"?: string,"created_at"?: string,"id"?: string,"inventory_location_id"?: string,"item_id"?: string,"notes"?: string | null,"occurred_at"?: string,"quantity"?: number,"recorded_by"?: string,"reference_id"?: string | null,"reference_type"?: string | null,"tenant_id"?: string,"transaction_type"?: string,"unit_cost"?: number | null,"vendor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_transactions_tenant_id_building_id_inventory_loc_fkey"
      columns: ["tenant_id","building_id","inventory_location_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "inventory_transactions_tenant_id_item_id_fkey"
      columns: ["tenant_id","item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "inventory_transactions_tenant_id_item_id_fkey"
      columns: ["tenant_id","item_id"]
isOneToOne: false
      referencedRelation: "inventory_stock"
      referencedColumns: ["tenant_id","item_id"]
    },{
      foreignKeyName: "inventory_transactions_tenant_id_vendor_id_fkey"
      columns: ["tenant_id","vendor_id"]
isOneToOne: false
      referencedRelation: "vendors"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"kitchen_daily_reports": {
                  Row: {
                    "actual_meal_count": number | null,"building_id": string,"chef_user_id": string,"created_at": string,"expected_meal_count": number | null,"id": string,"meal_type": string,"report_date": string,"status": string,"submitted_at": string | null,"summary": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_meal_count"?: number | null,"building_id": string,"chef_user_id": string,"created_at"?: string,"expected_meal_count"?: number | null,"id"?: string,"meal_type": string,"report_date": string,"status"?: string,"submitted_at"?: string | null,"summary"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "actual_meal_count"?: number | null,"building_id"?: string,"chef_user_id"?: string,"created_at"?: string,"expected_meal_count"?: number | null,"id"?: string,"meal_type"?: string,"report_date"?: string,"status"?: string,"submitted_at"?: string | null,"summary"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_daily_reports_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"maintenance_activity": {
                  Row: {
                    "actor_user_id": string | null,"created_at": string,"from_status": string | null,"id": string,"maintenance_request_id": string,"note": string | null,"tenant_id": string,"to_status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: string,"maintenance_request_id": string,"note"?: string | null,"tenant_id": string,"to_status"?: string | null
                  }
                  Update: {
                    "actor_user_id"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: string,"maintenance_request_id"?: string,"note"?: string | null,"tenant_id"?: string,"to_status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_activity_tenant_id_maintenance_request_id_fkey"
      columns: ["tenant_id","maintenance_request_id"]
isOneToOne: false
      referencedRelation: "maintenance_requests"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"maintenance_attachments": {
                  Row: {
                    "building_id": string,"created_at": string,"file_name": string | null,"id": string,"maintenance_request_id": string,"mime_type": string,"size_bytes": number,"storage_path": string,"tenant_id": string,"uploaded_at": string | null,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"created_at"?: string,"file_name"?: string | null,"id"?: string,"maintenance_request_id": string,"mime_type": string,"size_bytes": number,"storage_path": string,"tenant_id": string,"uploaded_at"?: string | null,"uploaded_by": string
                  }
                  Update: {
                    "building_id"?: string,"created_at"?: string,"file_name"?: string | null,"id"?: string,"maintenance_request_id"?: string,"mime_type"?: string,"size_bytes"?: number,"storage_path"?: string,"tenant_id"?: string,"uploaded_at"?: string | null,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_attachments_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "maintenance_attachments_tenant_id_maintenance_request_id_fkey"
      columns: ["tenant_id","maintenance_request_id"]
isOneToOne: false
      referencedRelation: "maintenance_requests"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"maintenance_categories": {
                  Row: {
                    "id": string,"is_active": boolean,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"name": string,"tenant_id": string
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_categories_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"maintenance_requests": {
                  Row: {
                    "assigned_to": string | null,"building_id": string,"category_id": string,"complaint_id": string | null,"completed_at": string | null,"completion_notes": string | null,"created_at": string,"created_by": string,"description": string,"due_at": string | null,"floor_id": string | null,"id": string,"priority": string,"reported_at": string,"room_id": string | null,"status": string,"tenant_id": string,"title": string,"updated_at": string,"vendor_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"building_id": string,"category_id": string,"complaint_id"?: string | null,"completed_at"?: string | null,"completion_notes"?: string | null,"created_at"?: string,"created_by": string,"description": string,"due_at"?: string | null,"floor_id"?: string | null,"id"?: string,"priority"?: string,"reported_at"?: string,"room_id"?: string | null,"status"?: string,"tenant_id": string,"title": string,"updated_at"?: string,"vendor_id"?: string | null
                  }
                  Update: {
                    "assigned_to"?: string | null,"building_id"?: string,"category_id"?: string,"complaint_id"?: string | null,"completed_at"?: string | null,"completion_notes"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string,"due_at"?: string | null,"floor_id"?: string | null,"id"?: string,"priority"?: string,"reported_at"?: string,"room_id"?: string | null,"status"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string,"vendor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_floor_fk"
      columns: ["tenant_id","building_id","floor_id"]
isOneToOne: false
      referencedRelation: "floors"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "maintenance_requests_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "maintenance_requests_tenant_id_category_id_fkey"
      columns: ["tenant_id","category_id"]
isOneToOne: false
      referencedRelation: "maintenance_categories"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "maintenance_requests_tenant_id_complaint_id_fkey"
      columns: ["tenant_id","complaint_id"]
isOneToOne: false
      referencedRelation: "complaints"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "maintenance_requests_tenant_id_vendor_id_fkey"
      columns: ["tenant_id","vendor_id"]
isOneToOne: false
      referencedRelation: "vendors"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "maintenance_room_fk"
      columns: ["tenant_id","building_id","room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["tenant_id","building_id","id"]
    }
                  ]
                },"meal_availability": {
                  Row: {
                    "building_id": string,"id": string,"is_unavailable": boolean,"meal_date": string,"meal_type": string,"resident_id": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"id"?: string,"is_unavailable": boolean,"meal_date": string,"meal_type": string,"resident_id": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "building_id"?: string,"id"?: string,"is_unavailable"?: boolean,"meal_date"?: string,"meal_type"?: string,"resident_id"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_availability_building_fk"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "meal_availability_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "meal_availability_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"meal_menus": {
                  Row: {
                    "building_id": string,"change_reason": string | null,"created_at": string,"id": string,"items": string,"meal_date": string,"meal_type": string,"published_at": string | null,"published_by": string | null,"serving_end": string | null,"serving_start": string | null,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"change_reason"?: string | null,"created_at"?: string,"id"?: string,"items": string,"meal_date": string,"meal_type": string,"published_at"?: string | null,"published_by"?: string | null,"serving_end"?: string | null,"serving_start"?: string | null,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "building_id"?: string,"change_reason"?: string | null,"created_at"?: string,"id"?: string,"items"?: string,"meal_date"?: string,"meal_type"?: string,"published_at"?: string | null,"published_by"?: string | null,"serving_end"?: string | null,"serving_start"?: string | null,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_menus_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"meal_reviews": {
                  Row: {
                    "admin_note": string | null,"building_id": string,"comment": string | null,"created_at": string,"id": string,"meal_menu_id": string,"rating": number,"resident_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"building_id": string,"comment"?: string | null,"created_at"?: string,"id"?: string,"meal_menu_id": string,"rating": number,"resident_id": string,"tenant_id": string
                  }
                  Update: {
                    "admin_note"?: string | null,"building_id"?: string,"comment"?: string | null,"created_at"?: string,"id"?: string,"meal_menu_id"?: string,"rating"?: number,"resident_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_reviews_tenant_id_meal_menu_id_fkey"
      columns: ["tenant_id","meal_menu_id"]
isOneToOne: false
      referencedRelation: "meal_menus"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "meal_reviews_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "meal_reviews_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"meal_settings": {
                  Row: {
                    "allow_reviews": boolean,"breakfast_cutoff": string,"dinner_cutoff": string,"lunch_cutoff": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_reviews"?: boolean,"breakfast_cutoff"?: string,"dinner_cutoff"?: string,"lunch_cutoff"?: string,"tenant_id": string
                  }
                  Update: {
                    "allow_reviews"?: boolean,"breakfast_cutoff"?: string,"dinner_cutoff"?: string,"lunch_cutoff"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_settings_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"notice_reads": {
                  Row: {
                    "id": string,"notice_id": string,"read_at": string,"resident_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"notice_id": string,"read_at"?: string,"resident_id": string,"tenant_id": string
                  }
                  Update: {
                    "id"?: string,"notice_id"?: string,"read_at"?: string,"resident_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notice_reads_notice_id_fkey"
      columns: ["notice_id"]
isOneToOne: false
      referencedRelation: "notices"
      referencedColumns: ["id"]
    }
                  ]
                },"notices": {
                  Row: {
                    "body": string,"building_id": string | null,"category": string,"created_at": string,"created_by": string,"expires_at": string | null,"id": string,"published_at": string | null,"status": string,"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"building_id"?: string | null,"category"?: string,"created_at"?: string,"created_by": string,"expires_at"?: string | null,"id"?: string,"published_at"?: string | null,"status"?: string,"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"building_id"?: string | null,"category"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string | null,"id"?: string,"published_at"?: string | null,"status"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notices_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": string,"read_at": string | null,"tenant_id": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"read_at"?: string | null,"tenant_id"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"read_at"?: string | null,"tenant_id"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_allocations": {
                  Row: {
                    "allocated_amount": number,"created_at": string,"id": string,"payment_transaction_id": string,"rent_charge_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allocated_amount": number,"created_at"?: string,"id"?: string,"payment_transaction_id": string,"rent_charge_id": string,"tenant_id": string
                  }
                  Update: {
                    "allocated_amount"?: number,"created_at"?: string,"id"?: string,"payment_transaction_id"?: string,"rent_charge_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_allocations_tenant_id_payment_transaction_id_fkey"
      columns: ["tenant_id","payment_transaction_id"]
isOneToOne: false
      referencedRelation: "payment_transactions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "payment_allocations_tenant_id_rent_charge_id_fkey"
      columns: ["tenant_id","rent_charge_id"]
isOneToOne: false
      referencedRelation: "rent_charge_balances"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "payment_allocations_tenant_id_rent_charge_id_fkey"
      columns: ["tenant_id","rent_charge_id"]
isOneToOne: false
      referencedRelation: "rent_charges"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"payment_transactions": {
                  Row: {
                    "amount": number,"building_id": string | null,"created_at": string,"id": string,"notes": string | null,"paid_at": string,"payment_method": string,"recorded_by": string,"resident_id": string,"reversal_reason": string | null,"reversed_at": string | null,"reversed_by": string | null,"status": string,"tenant_id": string,"transaction_reference": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"building_id"?: string | null,"created_at"?: string,"id"?: string,"notes"?: string | null,"paid_at": string,"payment_method": string,"recorded_by": string,"resident_id": string,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"status"?: string,"tenant_id": string,"transaction_reference"?: string | null
                  }
                  Update: {
                    "amount"?: number,"building_id"?: string | null,"created_at"?: string,"id"?: string,"notes"?: string | null,"paid_at"?: string,"payment_method"?: string,"recorded_by"?: string,"resident_id"?: string,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"status"?: string,"tenant_id"?: string,"transaction_reference"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_transactions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "payment_transactions_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"created_by": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"poll_options": {
                  Row: {
                    "id": string,"label": string,"poll_id": string,"position": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"label": string,"poll_id": string,"position": number,"tenant_id": string
                  }
                  Update: {
                    "id"?: string,"label"?: string,"poll_id"?: string,"position"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_options_tenant_id_poll_id_fkey"
      columns: ["tenant_id","poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"poll_votes": {
                  Row: {
                    "option_id": string,"poll_id": string,"resident_id": string,"tenant_id": string,"voted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "option_id": string,"poll_id": string,"resident_id": string,"tenant_id": string,"voted_at"?: string
                  }
                  Update: {
                    "option_id"?: string,"poll_id"?: string,"resident_id"?: string,"tenant_id"?: string,"voted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_votes_tenant_id_option_id_fkey"
      columns: ["tenant_id","option_id"]
isOneToOne: false
      referencedRelation: "poll_options"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "poll_votes_tenant_id_poll_id_fkey"
      columns: ["tenant_id","poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "poll_votes_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "poll_votes_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"polls": {
                  Row: {
                    "building_id": string | null,"closes_at": string | null,"created_at": string,"created_by": string,"id": string,"question": string,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id"?: string | null,"closes_at"?: string | null,"created_at"?: string,"created_by": string,"id"?: string,"question": string,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "building_id"?: string | null,"closes_at"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"question"?: string,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "polls_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "polls_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string | null,"full_name": string | null,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"receipt_counters": {
                  Row: {
                    "last_number": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_number"?: number,"tenant_id": string
                  }
                  Update: {
                    "last_number"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipt_counters_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"receipts": {
                  Row: {
                    "id": string,"issued_at": string,"issued_by": string,"payment_transaction_id": string,"receipt_number": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"issued_at"?: string,"issued_by": string,"payment_transaction_id": string,"receipt_number": string,"tenant_id": string
                  }
                  Update: {
                    "id"?: string,"issued_at"?: string,"issued_by"?: string,"payment_transaction_id"?: string,"receipt_number"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipts_tenant_id_payment_transaction_id_fkey"
      columns: ["tenant_id","payment_transaction_id"]
isOneToOne: false
      referencedRelation: "payment_transactions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"rent_charges": {
                  Row: {
                    "admission_id": string,"amount": number,"building_id": string,"charge_type": string,"created_at": string,"created_by": string | null,"description": string | null,"due_date": string,"id": string,"period_end": string | null,"period_start": string | null,"resident_id": string,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admission_id": string,"amount": number,"building_id": string,"charge_type": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"due_date": string,"id"?: string,"period_end"?: string | null,"period_start"?: string | null,"resident_id": string,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "admission_id"?: string,"amount"?: number,"building_id"?: string,"charge_type"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"due_date"?: string,"id"?: string,"period_end"?: string | null,"period_start"?: string | null,"resident_id"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rent_charges_tenant_id_admission_id_fkey"
      columns: ["tenant_id","admission_id"]
isOneToOne: false
      referencedRelation: "admissions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "rent_charges_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "rent_charges_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"resident_documents": {
                  Row: {
                    "building_id": string | null,"created_at": string,"document_type": string,"file_name": string | null,"id": string,"mime_type": string | null,"resident_id": string,"review_note": string | null,"size_bytes": number | null,"storage_path": string,"tenant_id": string,"uploaded_at": string | null,"uploaded_by": string | null,"verification_status": string,"verified_at": string | null,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id"?: string | null,"created_at"?: string,"document_type": string,"file_name"?: string | null,"id"?: string,"mime_type"?: string | null,"resident_id": string,"review_note"?: string | null,"size_bytes"?: number | null,"storage_path": string,"tenant_id": string,"uploaded_at"?: string | null,"uploaded_by"?: string | null,"verification_status"?: string,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "building_id"?: string | null,"created_at"?: string,"document_type"?: string,"file_name"?: string | null,"id"?: string,"mime_type"?: string | null,"resident_id"?: string,"review_note"?: string | null,"size_bytes"?: number | null,"storage_path"?: string,"tenant_id"?: string,"uploaded_at"?: string | null,"uploaded_by"?: string | null,"verification_status"?: string,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "resident_documents_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "resident_documents_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "resident_documents_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"resident_room_assignments": {
                  Row: {
                    "admission_id": string,"assigned_by": string,"bed_id": string,"building_id": string,"created_at": string,"end_at": string | null,"id": string,"resident_id": string,"room_id": string,"start_at": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admission_id": string,"assigned_by": string,"bed_id": string,"building_id": string,"created_at"?: string,"end_at"?: string | null,"id"?: string,"resident_id": string,"room_id": string,"start_at"?: string,"tenant_id": string
                  }
                  Update: {
                    "admission_id"?: string,"assigned_by"?: string,"bed_id"?: string,"building_id"?: string,"created_at"?: string,"end_at"?: string | null,"id"?: string,"resident_id"?: string,"room_id"?: string,"start_at"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_room_fk"
      columns: ["tenant_id","building_id","room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "resident_room_assignments_tenant_id_admission_id_fkey"
      columns: ["tenant_id","admission_id"]
isOneToOne: false
      referencedRelation: "admissions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "resident_room_assignments_tenant_id_building_id_bed_id_fkey"
      columns: ["tenant_id","building_id","bed_id"]
isOneToOne: false
      referencedRelation: "beds"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "resident_room_assignments_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "resident_room_assignments_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"residents": {
                  Row: {
                    "created_at": string,"date_of_birth": string | null,"email": string | null,"emergency_contact_name": string | null,"emergency_contact_phone": string | null,"full_name": string,"gender": string | null,"id": string,"id_number_last4": string | null,"occupation": string | null,"phone": string,"share_birthday": boolean,"status": string,"tenant_id": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"full_name": string,"gender"?: string | null,"id"?: string,"id_number_last4"?: string | null,"occupation"?: string | null,"phone": string,"share_birthday"?: boolean,"status"?: string,"tenant_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"full_name"?: string,"gender"?: string | null,"id"?: string,"id_number_last4"?: string | null,"occupation"?: string | null,"phone"?: string,"share_birthday"?: boolean,"status"?: string,"tenant_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "residents_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "base_monthly_rent": number,"building_id": string,"created_at": string,"floor_id": string,"id": string,"notes": string | null,"room_number": string,"sharing_capacity": number,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_monthly_rent"?: number,"building_id": string,"created_at"?: string,"floor_id": string,"id"?: string,"notes"?: string | null,"room_number": string,"sharing_capacity": number,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "base_monthly_rent"?: number,"building_id"?: string,"created_at"?: string,"floor_id"?: string,"id"?: string,"notes"?: string | null,"room_number"?: string,"sharing_capacity"?: number,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_tenant_id_building_id_floor_id_fkey"
      columns: ["tenant_id","building_id","floor_id"]
isOneToOne: false
      referencedRelation: "floors"
      referencedColumns: ["tenant_id","building_id","id"]
    }
                  ]
                },"staff_attendance": {
                  Row: {
                    "attendance_date": string,"building_id": string,"id": string,"marked_at": string,"marked_by": string,"notes": string | null,"staff_member_id": string,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_date": string,"building_id": string,"id"?: string,"marked_at"?: string,"marked_by": string,"notes"?: string | null,"staff_member_id": string,"status": string,"tenant_id": string
                  }
                  Update: {
                    "attendance_date"?: string,"building_id"?: string,"id"?: string,"marked_at"?: string,"marked_by"?: string,"notes"?: string | null,"staff_member_id"?: string,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_attendance_building_fk"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "staff_attendance_tenant_id_staff_member_id_fkey"
      columns: ["tenant_id","staff_member_id"]
isOneToOne: false
      referencedRelation: "staff_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"staff_daily_reports": {
                  Row: {
                    "building_id": string,"created_at": string,"id": string,"recorded_by": string,"report_date": string,"reviewed_at": string | null,"reviewed_by": string | null,"staff_member_id": string,"status": string,"tenant_id": string,"work_summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"created_at"?: string,"id"?: string,"recorded_by": string,"report_date": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"staff_member_id": string,"status"?: string,"tenant_id": string,"work_summary": string
                  }
                  Update: {
                    "building_id"?: string,"created_at"?: string,"id"?: string,"recorded_by"?: string,"report_date"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"staff_member_id"?: string,"status"?: string,"tenant_id"?: string,"work_summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_daily_reports_tenant_id_staff_member_id_fkey"
      columns: ["tenant_id","staff_member_id"]
isOneToOne: false
      referencedRelation: "staff_members"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"staff_members": {
                  Row: {
                    "building_id": string,"created_at": string,"full_name": string,"id": string,"joining_date": string | null,"membership_id": string | null,"monthly_salary": number,"pay_day": number | null,"phone": string | null,"role": string,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"created_at"?: string,"full_name": string,"id"?: string,"joining_date"?: string | null,"membership_id"?: string | null,"monthly_salary"?: number,"pay_day"?: number | null,"phone"?: string | null,"role": string,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "building_id"?: string,"created_at"?: string,"full_name"?: string,"id"?: string,"joining_date"?: string | null,"membership_id"?: string | null,"monthly_salary"?: number,"pay_day"?: number | null,"phone"?: string | null,"role"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_members_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "tenant_memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_members_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"subscription_plans": {
                  Row: {
                    "created_at": string,"id": string,"included_residents": number,"is_active": boolean,"is_default": boolean,"max_chefs": number,"max_managers": number,"monthly_price": number,"name": string,"trial_days": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"included_residents": number,"is_active"?: boolean,"is_default"?: boolean,"max_chefs": number,"max_managers": number,"monthly_price": number,"name": string,"trial_days"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"included_residents"?: number,"is_active"?: boolean,"is_default"?: boolean,"max_chefs"?: number,"max_managers"?: number,"monthly_price"?: number,"name"?: string,"trial_days"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "chef_limit": number,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"id": string,"manager_limit": number,"plan_id": string,"price_override": number | null,"resident_limit": number,"status": string,"tenant_id": string,"trial_end": string | null,"trial_start": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chef_limit": number,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"manager_limit": number,"plan_id": string,"price_override"?: number | null,"resident_limit": number,"status"?: string,"tenant_id": string,"trial_end"?: string | null,"trial_start"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "chef_limit"?: number,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"manager_limit"?: number,"plan_id"?: string,"price_override"?: number | null,"resident_limit"?: number,"status"?: string,"tenant_id"?: string,"trial_end"?: string | null,"trial_start"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "subscription_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_memberships": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"invite_email": string | null,"invited_by": string | null,"joined_at": string | null,"role": string,"status": string,"tenant_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"invite_email"?: string | null,"invited_by"?: string | null,"joined_at"?: string | null,"role": string,"status"?: string,"tenant_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"invite_email"?: string | null,"invited_by"?: string | null,"joined_at"?: string | null,"role"?: string,"status"?: string,"tenant_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_memberships_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_onboarding_requests": {
                  Row: {
                    "business_details": NonNullable<Json>,"contact_details": NonNullable<Json>,"created_at": string,"id": string,"review_notes": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"submitted_by": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_details"?: NonNullable<Json>,"contact_details"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"submitted_by": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "business_details"?: NonNullable<Json>,"contact_details"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"submitted_by"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_onboarding_requests_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"business_name": string,"city": string | null,"created_at": string,"currency": string,"email": string | null,"id": string,"owner_user_id": string,"phone": string | null,"status": string,"tenant_code": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"business_name": string,"city"?: string | null,"created_at"?: string,"currency"?: string,"email"?: string | null,"id"?: string,"owner_user_id": string,"phone"?: string | null,"status"?: string,"tenant_code"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"business_name"?: string,"city"?: string | null,"created_at"?: string,"currency"?: string,"email"?: string | null,"id"?: string,"owner_user_id"?: string,"phone"?: string | null,"status"?: string,"tenant_code"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"vendors": {
                  Row: {
                    "address": string | null,"contact_person": string | null,"created_at": string,"email": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"phone": string | null,"service_categories": (string)[],"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"contact_person"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"phone"?: string | null,"service_categories"?: (string)[],"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"contact_person"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"phone"?: string | null,"service_categories"?: (string)[],"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vendors_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"visitor_passes": {
                  Row: {
                    "building_id": string,"checked_in_at": string | null,"checked_out_at": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"pass_code": string | null,"purpose": string | null,"resident_id": string,"status": string,"tenant_id": string,"updated_at": string,"visit_date": string,"visitor_name": string,"visitor_phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "building_id": string,"checked_in_at"?: string | null,"checked_out_at"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"pass_code"?: string | null,"purpose"?: string | null,"resident_id": string,"status"?: string,"tenant_id": string,"updated_at"?: string,"visit_date": string,"visitor_name": string,"visitor_phone"?: string | null
                  }
                  Update: {
                    "building_id"?: string,"checked_in_at"?: string | null,"checked_out_at"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"pass_code"?: string | null,"purpose"?: string | null,"resident_id"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string,"visit_date"?: string,"visitor_name"?: string,"visitor_phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "visitor_passes_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "visitor_passes_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "visitor_passes_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                }
          }
          Views: {
            "expense_balances": {
                  Row: {
                    "approved_by": string | null,"building_id": string | null,"category_id": string | null,"created_at": string | null,"created_by": string | null,"description": string | null,"due_date": string | null,"expense_date": string | null,"floor_id": string | null,"id": string | null,"outstanding_amount": number | null,"paid_amount": number | null,"room_id": string | null,"source_id": string | null,"source_type": string | null,"status": string | null,"subtotal": number | null,"tax_amount": number | null,"tenant_id": string | null,"title": string | null,"total_amount": number | null,"updated_at": string | null,"vendor_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "approved_by"?: string | null,"building_id"?: string | null,"category_id"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"due_date"?: string | null,"expense_date"?: string | null,"floor_id"?: string | null,"id"?: string | null,"outstanding_amount"?: never,"paid_amount"?: never,"room_id"?: string | null,"source_id"?: string | null,"source_type"?: string | null,"status"?: string | null,"subtotal"?: number | null,"tax_amount"?: number | null,"tenant_id"?: string | null,"title"?: string | null,"total_amount"?: number | null,"updated_at"?: string | null,"vendor_id"?: string | null
                         }
                        Update: {
                           "approved_by"?: string | null,"building_id"?: string | null,"category_id"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"due_date"?: string | null,"expense_date"?: string | null,"floor_id"?: string | null,"id"?: string | null,"outstanding_amount"?: never,"paid_amount"?: never,"room_id"?: string | null,"source_id"?: string | null,"source_type"?: string | null,"status"?: string | null,"subtotal"?: number | null,"tax_amount"?: number | null,"tenant_id"?: string | null,"title"?: string | null,"total_amount"?: number | null,"updated_at"?: string | null,"vendor_id"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "expenses_floor_fk"
      columns: ["tenant_id","building_id","floor_id"]
isOneToOne: false
      referencedRelation: "floors"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "expenses_room_fk"
      columns: ["tenant_id","building_id","room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "expenses_tenant_id_building_id_fkey"
      columns: ["tenant_id","building_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "expenses_tenant_id_category_id_fkey"
      columns: ["tenant_id","category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "expenses_tenant_id_vendor_id_fkey"
      columns: ["tenant_id","vendor_id"]
isOneToOne: false
      referencedRelation: "vendors"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"inventory_balances": {
                  Row: {
                    "building_id": string | null,"inventory_location_id": string | null,"item_id": string | null,"quantity": number | null,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "inventory_transactions_tenant_id_building_id_inventory_loc_fkey"
      columns: ["tenant_id","building_id","inventory_location_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["tenant_id","building_id","id"]
    },{
      foreignKeyName: "inventory_transactions_tenant_id_item_id_fkey"
      columns: ["tenant_id","item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "inventory_transactions_tenant_id_item_id_fkey"
      columns: ["tenant_id","item_id"]
isOneToOne: false
      referencedRelation: "inventory_stock"
      referencedColumns: ["tenant_id","item_id"]
    }
                  ]
                },"inventory_stock": {
                  Row: {
                    "base_unit": string | null,"building_id": string | null,"building_name": string | null,"category": string | null,"has_movements": boolean | null,"is_active": boolean | null,"item_id": string | null,"kitchen_qty": number | null,"last_unit_cost": number | null,"name": string | null,"reorder_level": number | null,"store_qty": number | null,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"rent_charge_balances": {
                  Row: {
                    "admission_id": string | null,"amount": number | null,"balance": number | null,"building_id": string | null,"charge_type": string | null,"created_at": string | null,"created_by": string | null,"description": string | null,"due_date": string | null,"id": string | null,"paid_amount": number | null,"period_end": string | null,"period_start": string | null,"resident_id": string | null,"status": string | null,"tenant_id": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "admission_id"?: string | null,"amount"?: number | null,"balance"?: never,"building_id"?: string | null,"charge_type"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string | null,"paid_amount"?: never,"period_end"?: string | null,"period_start"?: string | null,"resident_id"?: string | null,"status"?: string | null,"tenant_id"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "admission_id"?: string | null,"amount"?: number | null,"balance"?: never,"building_id"?: string | null,"charge_type"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string | null,"paid_amount"?: never,"period_end"?: string | null,"period_start"?: string | null,"resident_id"?: string | null,"status"?: string | null,"tenant_id"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "rent_charges_tenant_id_admission_id_fkey"
      columns: ["tenant_id","admission_id"]
isOneToOne: false
      referencedRelation: "admissions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "rent_charges_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "resident_directory"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "rent_charges_tenant_id_resident_id_fkey"
      columns: ["tenant_id","resident_id"]
isOneToOne: false
      referencedRelation: "residents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"resident_directory": {
                  Row: {
                    "admission_date": string | null,"admission_id": string | null,"bed_id": string | null,"bed_label": string | null,"building_id": string | null,"building_name": string | null,"created_at": string | null,"email": string | null,"floor_id": string | null,"full_name": string | null,"has_login": boolean | null,"id": string | null,"monthly_rent": number | null,"outstanding": number | null,"phone": string | null,"room_id": string | null,"room_number": string | null,"sharing_capacity": number | null,"start_at": string | null,"status": string | null,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "residents_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_idem_get":
{ Args: { "p_key": string,"p_op": string,"p_tenant": string }; Returns: Json
                           },
"_idem_put":
{ Args: { "p_key": string,"p_op": string,"p_result": Json,"p_tenant": string }; Returns: undefined
                           },
"_location":
{ Args: { "p_building": string,"p_kind": string }; Returns: string
                           },
"_my_stay":
{ Args: Record<PropertyKey, never>; Returns: {
              "building_id": string,"full_name": string,"resident_id": string,"room_id": string,"tenant_id": string
            }[]
                           },
"_notify":
{ Args: { "p_body": string,"p_entity"?: string,"p_entity_type"?: string,"p_tenant": string,"p_title": string,"p_type": string,"p_user": string }; Returns: undefined
                           },
"_notify_building_residents":
{ Args: { "p_body": string,"p_building": string,"p_tenant": string,"p_title": string,"p_type": string }; Returns: undefined
                           },
"_notify_owners":
{ Args: { "p_body": string,"p_entity"?: string,"p_entity_type"?: string,"p_tenant": string,"p_title": string,"p_type": string }; Returns: undefined
                           },
"_post_stock":
{ Args: { "p_building": string,"p_item": string,"p_location": string,"p_notes": string,"p_qty": number,"p_ref": string,"p_ref_type": string,"p_tenant": string,"p_type": string,"p_unit_cost": number,"p_vendor": string }; Returns: string
                           },
"_provision_building":
{ Args: { "p_building": string,"p_tenant": string }; Returns: undefined
                           },
"_provision_tenant_defaults":
{ Args: { "p_tenant": string }; Returns: undefined
                           },
"_refresh_charge_status":
{ Args: { "p_charge": string }; Returns: undefined
                           },
"_require_building":
{ Args: { "p_building": string,"p_roles": (string)[] }; Returns: string
                           },
"_require_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"_tenant_today":
{ Args: { "p_tenant": string }; Returns: string
                           },
"_trusted":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"_uid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_upload_bucket":
{ Args: { "p_kind": string }; Returns: string
                           },
"_upload_ext":
{ Args: { "p_mime": string }; Returns: string
                           },
"add_charge":
{ Args: { "p_amount": number,"p_description": string,"p_due": string,"p_resident": string,"p_type": string }; Returns: string
                           },
"app_error":
{ Args: { "p_code": string,"p_message": string }; Returns: undefined
                           },
"archive_notice":
{ Args: { "p_notice": string }; Returns: undefined
                           },
"begin_upload":
{ Args: { "p_document_type"?: string,"p_file_name"?: string,"p_kind": string,"p_mime": string,"p_record": string,"p_size": number }; Returns: Json
                           },
"building_birthdays":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"building_layout":
{ Args: { "p_building": string }; Returns: Json
                           },
"can_access_building":
{ Args: { "p_building": string,"p_roles"?: (string)[],"p_tenant": string }; Returns: boolean
                           },
"can_read_channel":
{ Args: { "p_channel": string }; Returns: boolean
                           },
"can_see_poll":
{ Args: { "p_building": string,"p_tenant": string }; Returns: boolean
                           },
"can_staff_view_resident":
{ Args: { "p_resident": string,"p_roles"?: (string)[],"p_tenant": string }; Returns: boolean
                           },
"cancel_visitor_pass":
{ Args: { "p_pass": string }; Returns: undefined
                           },
"checkout_resident":
{ Args: { "p_admission": string,"p_checkout_date": string,"p_deposit_refund": number,"p_reason": string }; Returns: Json
                           },
"claim_pending_access":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"close_poll":
{ Args: { "p_poll": string }; Returns: undefined
                           },
"complete_upload":
{ Args: { "p_id": string,"p_kind": string }; Returns: undefined
                           },
"create_admission":
{ Args: { "p_bed": string,"p_idempotency_key": string,"p_resident": Json,"p_terms": Json }; Returns: string
                           },
"create_chat_group":
{ Args: { "p_building": string,"p_name": string,"p_residents_can_post": boolean }; Returns: string
                           },
"create_community_post":
{ Args: { "p_body": string,"p_kind": string,"p_price"?: number,"p_title": string }; Returns: string
                           },
"create_complaint":
{ Args: { "p_category": string,"p_description": string,"p_priority"?: string,"p_title": string }; Returns: string
                           },
"create_expense":
{ Args: { "p_building": string,"p_category": string,"p_description": string,"p_due_date": string,"p_expense_date": string,"p_idempotency_key": string,"p_initial_payment": Json,"p_source_id": string,"p_source_type": string,"p_subtotal": number,"p_tax": number,"p_title": string,"p_vendor": string }; Returns: string
                           },
"create_floor":
{ Args: { "p_building": string,"p_floor_number": number,"p_name"?: string }; Returns: string
                           },
"create_maintenance_request":
{ Args: { "p_assigned_to": string,"p_building": string,"p_category": string,"p_complaint": string,"p_description": string,"p_due_at": string,"p_floor": string,"p_priority": string,"p_room": string,"p_title": string,"p_vendor": string }; Returns: string
                           },
"create_poll":
{ Args: { "p_building": string,"p_closes_at"?: string,"p_options": (string)[],"p_question": string }; Returns: string
                           },
"create_room_with_beds":
{ Args: { "p_capacity": number,"p_floor": string,"p_monthly_rent": number,"p_room_number": string }; Returns: string
                           },
"generate_monthly_charges":
{ Args: { "p_building": string,"p_month": string }; Returns: number
                           },
"has_tenant_role":
{ Args: { "p_roles": (string)[],"p_tenant": string }; Returns: boolean
                           },
"inventory_direction":
{ Args: { "p_type": string }; Returns: number
                           },
"inventory_move":
{ Args: { "p_action": string,"p_building": string,"p_idempotency_key": string,"p_item": string,"p_notes": string,"p_qty": number,"p_unit_cost": number,"p_vendor": string }; Returns: Json
                           },
"invite_staff_account":
{ Args: { "p_building_ids": (string)[],"p_email": string,"p_name": string,"p_role": string }; Returns: string
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_tenant_owner":
{ Args: { "p_tenant": string }; Returns: boolean
                           },
"mark_channel_read":
{ Args: { "p_channel": string }; Returns: undefined
                           },
"mark_notice_read":
{ Args: { "p_notice": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mark_staff_attendance":
{ Args: { "p_building": string,"p_date": string,"p_entries": Json }; Returns: number
                           },
"meal_count_summary":
{ Args: { "p_building": string,"p_date": string }; Returns: Json
                           },
"my_access":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_building_ids":
{ Args: { "p_roles"?: (string)[] }; Returns: string[]
                           },
"my_chat_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_resident_building_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_resident_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_resident_profile":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"owner_dashboard_summary":
{ Args: { "p_building"?: string,"p_month"?: string }; Returns: Json
                           },
"pay_staff_salary":
{ Args: { "p_amount": number,"p_method": string,"p_month": string,"p_reference": string,"p_staff": string }; Returns: string
                           },
"platform_review_building":
{ Args: { "p_building": string,"p_decision": string,"p_notes"?: string }; Returns: undefined
                           },
"platform_review_onboarding":
{ Args: { "p_decision": string,"p_notes"?: string,"p_request": string }; Returns: undefined
                           },
"platform_set_tenant_status":
{ Args: { "p_reason": string,"p_status": string,"p_tenant": string }; Returns: undefined
                           },
"platform_update_subscription":
{ Args: { "p_chef_limit": number,"p_manager_limit": number,"p_price_override": number,"p_resident_limit": number,"p_status": string,"p_tenant": string,"p_trial_end": string }; Returns: undefined
                           },
"platform_upsert_plan":
{ Args: { "p_id": string,"p_included_residents": number,"p_is_active": boolean,"p_max_chefs": number,"p_max_managers": number,"p_monthly_price": number,"p_name": string,"p_trial_days": number }; Returns: string
                           },
"poll_summaries":
{ Args: { "p_building"?: string }; Returns: Json
                           },
"publish_notice":
{ Args: { "p_body": string,"p_building": string,"p_category": string,"p_expires_at": string,"p_title": string }; Returns: string
                           },
"record_expense_payment":
{ Args: { "p_amount": number,"p_expense": string,"p_idempotency_key": string,"p_method": string,"p_notes": string,"p_paid_at": string,"p_reference": string }; Returns: string
                           },
"record_payment":
{ Args: { "p_allocations": Json,"p_amount": number,"p_idempotency_key": string,"p_method": string,"p_notes"?: string,"p_paid_at": string,"p_reference": string,"p_resident": string }; Returns: Json
                           },
"request_building":
{ Args: { "p_address": string,"p_city": string,"p_details"?: Json,"p_name": string }; Returns: string
                           },
"request_visitor_pass":
{ Args: { "p_date": string,"p_name": string,"p_phone": string,"p_purpose"?: string }; Returns: string
                           },
"respond_community_post":
{ Args: { "p_close"?: boolean,"p_post": string,"p_response"?: string }; Returns: undefined
                           },
"reverse_payment":
{ Args: { "p_payment": string,"p_reason": string }; Returns: undefined
                           },
"review_admission":
{ Args: { "p_admission": string,"p_decision": string,"p_notes"?: string }; Returns: Json
                           },
"review_resident_document":
{ Args: { "p_decision": string,"p_document": string,"p_note"?: string }; Returns: undefined
                           },
"room_update_capacity":
{ Args: { "p_capacity": number,"p_monthly_rent": number,"p_room": string }; Returns: undefined
                           },
"send_chat_message":
{ Args: { "p_body": string,"p_channel": string }; Returns: string
                           },
"set_meal_availability":
{ Args: { "p_date": string,"p_meal_type": string,"p_unavailable": boolean }; Returns: undefined
                           },
"set_membership_status":
{ Args: { "p_membership": string,"p_status": string }; Returns: undefined
                           },
"set_message_pinned":
{ Args: { "p_message": string,"p_pinned": boolean }; Returns: undefined
                           },
"set_share_birthday":
{ Args: { "p_share": boolean }; Returns: undefined
                           },
"storage_can_read":
{ Args: { "p_bucket": string,"p_name": string }; Returns: boolean
                           },
"storage_can_write":
{ Args: { "p_bucket": string,"p_name": string }; Returns: boolean
                           },
"submit_kitchen_report":
{ Args: { "p_actual_count": number,"p_building": string,"p_date": string,"p_idempotency_key": string,"p_lines": Json,"p_meal_type": string,"p_summary": string }; Returns: string
                           },
"submit_meal_review":
{ Args: { "p_comment": string,"p_menu": string,"p_rating": number }; Returns: undefined
                           },
"submit_onboarding":
{ Args: { "p_buildings": Json,"p_business_name": string,"p_city": string,"p_notes"?: string,"p_phone": string }; Returns: string
                           },
"submit_staff_daily_report":
{ Args: { "p_date": string,"p_staff": string,"p_summary": string }; Returns: string
                           },
"update_complaint_status":
{ Args: { "p_complaint": string,"p_notes"?: string,"p_status": string }; Returns: undefined
                           },
"update_maintenance_status":
{ Args: { "p_assigned_to"?: string,"p_note"?: string,"p_request": string,"p_status": string }; Returns: undefined
                           },
"update_visitor_pass":
{ Args: { "p_action": string,"p_note"?: string,"p_pass": string }; Returns: Json
                           },
"upsert_meal_menu":
{ Args: { "p_building": string,"p_change_reason"?: string,"p_date": string,"p_items": string,"p_meal_type": string,"p_serving_end": string,"p_serving_start": string }; Returns: string
                           },
"upsert_staff_member":
{ Args: { "p_building": string,"p_full_name": string,"p_id": string,"p_joining_date": string,"p_monthly_salary": number,"p_pay_day": number,"p_phone": string,"p_role": string,"p_status": string }; Returns: string
                           },
"vote_poll":
{ Args: { "p_option": string,"p_poll": string }; Returns: undefined
                           },
"waive_charge":
{ Args: { "p_charge": string,"p_reason": string }; Returns: undefined
                           },
"write_audit":
{ Args: { "p_action": string,"p_after"?: Json,"p_before"?: Json,"p_entity_id": string,"p_entity_type": string,"p_tenant": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
