export const MEMBER_KINDS = ['full', 'tenant', 'associate', 'honorary'] as const
export const MEMBER_STATUSES = ['pending', 'active', 'suspended', 'lapsed'] as const

export type MemberKind = (typeof MEMBER_KINDS)[number]
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

export type Member = {
  id: string
  user_id: string | null
  member_no: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  kind: MemberKind
  status: MemberStatus
  joined_on: string
  left_on: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type MemberWriteInput = {
  member_no: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  kind: MemberKind
  status: MemberStatus
  joined_on: string
  left_on: string | null
}