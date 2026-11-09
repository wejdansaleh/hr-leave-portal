export interface Employee {
  employeeId: string
  name: string
  department: string
  startDate: string
  role: string
}

export interface NewEmployee {
  name: string
  department: string
  startDate: string
  role: string
}

export interface LeaveRecord {
  employeeId: string
  startDate: string
  endDate: string
  note: string
}

export interface NewLeave {
  startDate: string
  endDate: string
  note: string
}

export interface LeaveUpdate {
  endDate: string
  note: string
}

export interface HrRequestResponse {
  executionArn: string
}
