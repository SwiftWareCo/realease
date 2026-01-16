'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

interface LeadCaptureFormProps {
  formId?: string;
}

export function LeadCaptureForm({ formId }: LeadCaptureFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: searchParams.get('phone') || '', // Pre-fill from SMS link!
    email: '',
    property_address: '',
    timeline: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/submitLeadForm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: `sms_link_${formId || 'unknown'}`, // Track that this came from SMS (includes formId for intent detection)
        }),
      });

      if (response.ok) {
        toast.success('Form submitted successfully!');
        router.push('/lead/success');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(
          errorData.message || 'Failed to submit form. Please try again.'
        );
      }
    } catch (error) {
      console.error(error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='w-full max-w-md shadow-2xl'>
      <CardHeader>
        <CardTitle className='text-2xl text-center'>
          Get Your Free Home Valuation
        </CardTitle>
        <p className='text-sm text-gray-600 text-center dark:text-gray-400'>
          Mike&apos;s Real Estate Team
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <Input
            placeholder='Full Name *'
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            type='tel'
            placeholder='Phone Number *'
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            required
            disabled={!!searchParams.get('phone')} // Lock if pre-filled from SMS
          />

          <Input
            type='email'
            placeholder='Email (optional)'
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          <Input
            placeholder='Property Address *'
            value={formData.property_address}
            onChange={(e) =>
              setFormData({ ...formData, property_address: e.target.value })
            }
            required
          />

          <Select
            onValueChange={(value) =>
              setFormData({ ...formData, timeline: value })
            }
            required
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='When are you looking to sell?' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='within_1_month'>Within 1 month</SelectItem>
              <SelectItem value='3-6_months'>3-6 months</SelectItem>
              <SelectItem value='just_browsing'>Just browsing</SelectItem>
            </SelectContent>
          </Select>

          <div className='space-y-2'>
            <Label htmlFor='notes'>Additional Details (Optional)</Label>
            <textarea
              id='notes'
              placeholder='Tell us more: Move-in timeline? Budget? # of bedrooms?'
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className='file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none'
            />
            <p className='text-xs text-muted-foreground'>
              Realtors use this to prepare better
            </p>
          </div>

          <Button type='submit' className='w-full' disabled={loading}>
            {loading ? 'Sending...' : 'Get My Valuation →'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
