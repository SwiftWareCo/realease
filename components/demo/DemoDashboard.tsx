'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from 'sonner';

export function DemoDashboard() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [formId, setFormId] = useState("open_house_demo");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const sendDemoLink = useAction(api.demo.demo.sendDemoSMS);

  const handleSendLink = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    setLoading(true);
    setSuccess(false);
    
    try {
      // Generate unique link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const link = `${baseUrl}/lead/${formId}?phone=${encodeURIComponent(phoneNumber)}`;
      
      // Send via Twilio
      await sendDemoLink({ 
        phone: phoneNumber, 
        link,
        formId 
      });
      
      toast.success('Link sent! Check your phone for the SMS.');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error(error);
      toast.error('Failed to send SMS. Please check your Twilio configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Demo Lead Capture</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Your Phone Number</Label>
          <Input 
            id="phone"
            type="tel" 
            placeholder="+16045551234"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="scenario">Lead Source Scenario</Label>
          <Select value={formId} onValueChange={setFormId}>
            <SelectTrigger id="scenario" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open_house_demo">Open House QR Code</SelectItem>
              <SelectItem value="google_business_demo">Google Business Message</SelectItem>
              <SelectItem value="buyer_guide_demo">Buyer Guide Download</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSendLink} className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send Demo Link via SMS"}
        </Button>

        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>What happens:</strong> <br/>
            1. You get SMS with link <br/>
            2. Open link → Pre-filled form <br/>
            3. Submit → Lead appears in dashboard <br/>
            4. You get follow-up SMS in 5 seconds
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
