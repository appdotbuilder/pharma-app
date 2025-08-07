
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { User, Consultation as ConsultationType, CreateConsultationInput } from '../../../server/src/schema';

interface ConsultationProps {
  currentUser: User;
}

export function Consultation({ currentUser }: ConsultationProps) {
  const [consultations, setConsultations] = useState<ConsultationType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [consultationForm, setConsultationForm] = useState<CreateConsultationInput>({
    subject: '',
    message: ''
  });

  const loadConsultations = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.consultations.getUserConsultations.query({ userId: currentUser.id });
      setConsultations(result);
    } catch (error) {
      console.error('Failed to load consultations:', error);
      setConsultations([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadConsultations();
  }, [loadConsultations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAlert(null);
    
    try {
      await trpc.consultations.create.mutate({
        userId: currentUser.id,
        ...consultationForm
      });
      
      setAlert({ 
        type: 'success', 
        message: 'Consultation request submitted! Our pharmacist will respond within 24 hours.' 
      });
      
      // Reset form
      setConsultationForm({
        subject: '',
        message: ''
      });
      
      // Reload consultations
      loadConsultations();
      
      setTimeout(() => setAlert(null), 5000);
    } catch (error) {
      console.error('Failed to create consultation:', error);
      setAlert({ type: 'error', message: 'Failed to submit consultation. Please try again.' });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in_progress': return '👨‍⚕️';
      case 'completed': return '✅';
      default: return '💬';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">👨‍⚕️ Pharmacist Consultation</h2>
        <Badge variant="outline" className="text-sm">
          {consultations.length} consultations
        </Badge>
      </div>

      {alert && (
        <Alert variant={alert.type === 'success' ? 'default' : 'destructive'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New Consultation Form */}
        <Card>
          <CardHeader>
            <CardTitle>💬 Ask a Pharmacist</CardTitle>
            <CardDescription>
              Get professional advice about medications, dosage, and health concerns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={consultationForm.subject}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConsultationForm((prev: CreateConsultationInput) => ({ ...prev, subject: e.target.value }))
                  }
                  placeholder="e.g., Drug interaction question, Dosage inquiry"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Your Question</Label>
                <Textarea
                  id="message"
                  value={consultationForm.message}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setConsultationForm((prev: CreateConsultationInput) => ({ ...prev, message: e.target.value }))
                  }
                  placeholder="Please describe your question or concern in detail. Include any relevant medical history, current medications, or specific symptoms."
                  rows={6}
                  required
                />
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  ⚠️ <strong>Disclaimer:</strong> This consultation is for informational purposes only 
                  and does not replace professional medical advice. For emergencies, contact your doctor 
                  or emergency services immediately.
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : '💬 Submit Consultation'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Consultation History */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>📋 Your Consultations</CardTitle>
              <CardDescription>
                View your consultation history and pharmacist responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-gray-500 text-center py-4">Loading consultations...</p>
              ) : consultations.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl mb-2 block">👨‍⚕️</span>
                  <p className="text-gray-500">No consultations yet</p>
                  <p className="text-sm text-gray-400">Ask your first question to get started</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {consultations.map((consultation: ConsultationType) => (
                    <div key={consultation.id} className="border rounded-md p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{consultation.subject}</h3>
                        <Badge className={getStatusColor(consultation.status)}>
                          {getStatusIcon(consultation.status)} {consultation.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="text-sm">
                        <p className="text-gray-600 mb-2">{consultation.message}</p>
                        <p className="text-xs text-gray-500">
                          Asked on {consultation.created_at.toLocaleDateString()} at {consultation.created_at.toLocaleTimeString()}
                        </p>
                      </div>
                      
                      {consultation.response && (
                        <>
                          <Separator />
                          <div className="bg-blue-50 p-3 rounded-md">
                            <p className="text-sm font-medium text-blue-800 mb-1">Pharmacist Response:</p>
                            <p className="text-sm text-blue-700">{consultation.response}</p>
                            <p className="text-xs text-blue-600 mt-2">
                              Responded on {consultation.updated_at.toLocaleDateString()}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Common Questions Card */}
          <Card>
            <CardHeader>
              <CardTitle>❓ Common Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Can I take these medications together?</p>
                <p className="text-gray-600">Ask about drug interactions and safety</p>
              </div>
              <Separator />
              <div>
                <p className="font-medium">What's the correct dosage for my age/weight?</p>
                <p className="text-gray-600">Get personalized dosage recommendations</p>
              </div>
              <Separator />
              <div>
                <p className="font-medium">What are the side effects?</p>
                <p className="text-gray-600">Learn about potential side effects and warnings</p>
              </div>
              <Separator />
              <div>
                <p className="font-medium">Storage and expiration questions</p>
                <p className="text-gray-600">How to properly store medications</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
