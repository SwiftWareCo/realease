'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, MapPin, GripVertical, MessageSquare, TrendingUp } from 'lucide-react';
import { useState } from 'react';

const statuses = [
  { id: 'new', label: 'New', color: 'bg-blue-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-green-500' },
] as const;

type Status = 'new' | 'contacted' | 'qualified';

interface LeadCardProps {
  lead: Doc<'leads'>;
}

function LeadCard({ lead }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getIntentBadge = (intent: string) => {
    switch (intent) {
      case 'buyer':
        return (
          <Badge
            variant='outline'
            className='border-blue-300 text-blue-700 dark:text-blue-300 text-xs'
          >
            Buyer
          </Badge>
        );
      case 'seller':
        return (
          <Badge
            variant='outline'
            className='border-green-300 text-green-700 dark:text-green-300 text-xs'
          >
            Seller
          </Badge>
        );
      case 'investor':
        return (
          <Badge
            variant='outline'
            className='border-purple-300 text-purple-700 dark:text-purple-300 text-xs'
          >
            Investor
          </Badge>
        );
      default:
        return <Badge variant='outline' className='text-xs'>{intent}</Badge>;
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 80) return 'text-red-600 dark:text-red-400 font-semibold';
    if (score >= 60) return 'text-orange-600 dark:text-orange-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null;
    switch (sentiment) {
      case 'positive':
        return (
          <Badge variant='outline' className='border-green-300 text-green-700 dark:text-green-300 text-xs'>
            +
          </Badge>
        );
      case 'negative':
        return (
          <Badge variant='outline' className='border-red-300 text-red-700 dark:text-red-300 text-xs'>
            -
          </Badge>
        );
      default:
        return (
          <Badge variant='outline' className='border-gray-300 text-gray-700 dark:text-gray-300 text-xs'>
            ~
          </Badge>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing'
      {...attributes}
      {...listeners}
    >
      <div className='flex items-start justify-between gap-2 mb-2'>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <GripVertical className='h-4 w-4 text-muted-foreground shrink-0' />
          <User className='h-4 w-4 text-muted-foreground shrink-0' />
          <span className='font-medium text-sm truncate'>{lead.name}</span>
          {lead.notes && (
            <MessageSquare className='h-3 w-3 text-blue-500 shrink-0' />
          )}
        </div>
        <div className='flex flex-col items-end gap-1 shrink-0'>
          <span className={`text-xs font-semibold ${getUrgencyColor(lead.urgency_score)}`}>
            {lead.urgency_score}
          </span>
          {getSentimentBadge(lead.last_message_sentiment)}
        </div>
      </div>

      <div className='space-y-1.5 text-xs'>
        <div className='flex items-center gap-1 text-muted-foreground'>
          <Phone className='h-3 w-3' />
          <span className='truncate'>{lead.phone}</span>
        </div>
        {lead.email && (
          <div className='flex items-center gap-1 text-muted-foreground'>
            <Mail className='h-3 w-3' />
            <span className='truncate'>{lead.email}</span>
          </div>
        )}
        {lead.property_address && (
          <div className='flex items-start gap-1'>
            <MapPin className='h-3 w-3 text-muted-foreground mt-0.5 shrink-0' />
            <span className='text-muted-foreground truncate text-xs'>
              {lead.property_address}
            </span>
          </div>
        )}
      </div>

      {lead.notes && (
        <div className='mt-2 pt-2 border-t'>
          <div className='flex items-start gap-1'>
            <MessageSquare className='h-3 w-3 text-blue-500 shrink-0 mt-0.5' />
            <p className='text-xs text-muted-foreground line-clamp-2 italic'>
              {lead.notes}
            </p>
          </div>
        </div>
      )}

      <div className='flex items-center justify-between mt-2 pt-2 border-t'>
        {getIntentBadge(lead.intent)}
        {lead.conversion_prediction && (
          <Badge variant='outline' className='text-xs border-blue-300 text-blue-700 dark:text-blue-300'>
            <TrendingUp className='h-3 w-3 mr-1' />
            {lead.conversion_prediction}
          </Badge>
        )}
      </div>

      {lead.ai_suggestion && (
        <div className='mt-2 pt-2 border-t'>
          <p className='text-xs text-muted-foreground line-clamp-2'>
            💡 {lead.ai_suggestion}
          </p>
        </div>
      )}
    </div>
  );
}

interface StatusColumnProps {
  status: Status;
  leads: Doc<'leads'>[];
  label: string;
  color: string;
}

function StatusColumn({ status, leads, label, color }: StatusColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className='flex flex-col h-full'>
      <Card className='flex-1 flex flex-col'>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-sm font-medium'>{label}</CardTitle>
            <Badge variant='default' className={color}>
              {leads.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className={`flex-1 overflow-y-auto transition-colors ${
            isOver ? 'bg-muted/50' : ''
          }`}
        >
          <SortableContext
            items={leads.map((l) => l._id)}
            strategy={verticalListSortingStrategy}
          >
            <div className='space-y-2'>
              {leads.length === 0 ? (
                <div className='text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg'>
                  Drop leads here
                </div>
              ) : (
                leads.map((lead) => <LeadCard key={lead._id} lead={lead} />)
              )}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}

export function LeadsKanbanBoard() {
  const allLeads = useQuery(api.leads.queries.getAllLeads);
  const updateStatus = useMutation(api.leads.mutations.updateLeadStatus);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const leadsByStatus = statuses.reduce(
    (acc, status) => {
      acc[status.id] =
        allLeads?.filter((lead) => lead.status === status.id) || [];
      return acc;
    },
    {} as Record<Status, Doc<'leads'>[]>
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const leadId = active.id as Id<'leads'>;
    const newStatus = over.id as Status;

    // Find current lead status
    const lead = allLeads?.find((l) => l._id === leadId);
    if (!lead || lead.status === newStatus) return;

    // Update status
    await updateStatus({ id: leadId, status: newStatus });
  };

  const activeLead = allLeads?.find((l) => l._id === activeId);

  if (allLeads === undefined) {
    return (
      <Card>
        <CardContent className='p-8 text-center'>
          <p className='text-muted-foreground'>Loading leads...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-300px)]'>
        {statuses.map((status) => (
          <StatusColumn
            key={status.id}
            status={status.id}
            leads={leadsByStatus[status.id]}
            label={status.label}
            color={status.color}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className='bg-card border rounded-lg p-3 shadow-lg rotate-3 opacity-90 w-64'>
            <div className='flex items-center gap-2 mb-2'>
              <User className='h-4 w-4 text-muted-foreground' />
              <span className='font-medium text-sm'>{activeLead.name}</span>
            </div>
            <div className='text-xs text-muted-foreground'>
              {activeLead.phone}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
