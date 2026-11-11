import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const useDepartments = () =>
  useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const list = await base44.entities.Department.list();
      return [...list].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
    },
  });

export const useMissions = () =>
  useQuery({ queryKey: ['missions'], queryFn: () => base44.entities.Mission.list() });

export const useEvidence = () =>
  useQuery({ queryKey: ['evidence'], queryFn: () => base44.entities.Evidence.list() });

export const useAssessments = () =>
  useQuery({ queryKey: ['assessments'], queryFn: () => base44.entities.Assessment.list() });

export const usePortfolio = () =>
  useQuery({ queryKey: ['portfolio'], queryFn: () => base44.entities.PortfolioPiece.list() });

export const useReminders = () =>
  useQuery({ queryKey: ['reminders'], queryFn: () => base44.entities.Reminder.list() });