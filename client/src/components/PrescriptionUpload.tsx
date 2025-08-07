
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { User, Prescription, UploadPrescriptionInput } from '../../../server/src/schema';

interface PrescriptionUploadProps {
  currentUser: User;
}

export function PrescriptionUpload({ currentUser }: PrescriptionUploadProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadPrescriptionInput>({
    doctor_name: '',
    doctor_license: '',
    prescription_date: new Date(),
    image_url: ''
  });

  const loadPrescriptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.prescriptions.getUserPrescriptions.query({ userId: currentUser.id });
      setPrescriptions(result);
    } catch (error) {
      console.error('Failed to load prescriptions:', error);
      setPrescriptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setAlert(null);
    
    try {
      // Stub: In a real implementation, you'd handle file upload to cloud storage
      // For now, we'll use a placeholder image URL
      const prescriptionWithImageUrl = {
        ...uploadForm,
        image_url: 'https://example.com/prescription-image.jpg' // Stub image URL
      };
      
      await trpc.prescriptions.upload.mutate({
        userId: currentUser.id,
        ...prescriptionWithImageUrl
      });
      
      setAlert({ type: 'success', message: 'Prescription uploaded successfully! It will be reviewed by our pharmacists.' });
      
      // Reset form
      setUploadForm({
        doctor_name: '',
        doctor_license: '',
        prescription_date: new Date(),
        image_url: ''
      });
      
      // Reload prescriptions
      loadPrescriptions();
      
      setTimeout(() => setAlert(null), 5000);
    } catch (error) {
      console.error('Failed to upload prescription:', error);
      setAlert({ type: 'error', message: 'Failed to upload prescription. Please try again.' });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'verified': return '✅';
      case 'rejected': return '❌';
      default: return '📋';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">💊 Digital Prescriptions</h2>
        <Badge variant="outline" className="text-sm">
          {prescriptions.length} prescriptions
        </Badge>
      </div>

      {alert && (
        <Alert variant={alert.type === 'success' ? 'default' : 'destructive'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>📤 Upload New Prescription</CardTitle>
            <CardDescription>
              Upload your doctor's prescription for prescription medicines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doctor-name">Doctor's Name</Label>
                <Input
                  id="doctor-name"
                  value={uploadForm.doctor_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setUploadForm((prev: UploadPrescriptionInput) => ({ ...prev, doctor_name: e.target.value }))
                  }
                  placeholder="Dr. John Smith"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctor-license">Doctor's License Number</Label>
                <Input
                  id="doctor-license"
                  value={uploadForm.doctor_license}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setUploadForm((prev: UploadPrescriptionInput) => ({ ...prev, doctor_license: e.target.value }))
                  }
                  placeholder="MD12345"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prescription-date">Prescription Date</Label>
                <Input
                  id="prescription-date"
                  type="date"
                  value={uploadForm.prescription_date.toISOString().split('T')[0]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setUploadForm((prev: UploadPrescriptionInput) => ({ 
                      ...prev, 
                      prescription_date: new Date(e.target.value) 
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prescription-image">Prescription Image</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                  <div className="space-y-2">
                    <span className="text-4xl">📷</span>
                    <p className="text-sm text-gray-600">
                      Click to upload prescription image
                    </p>
                    <p className="text-xs text-gray-500">
                      Supported: JPG, PNG, PDF (Max 10MB)
                    </p>
                    {/* Stub: In a real implementation, you'd have file input and upload handling */}
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  📝 <strong>Important:</strong> Ensure your prescription is clear and all details are visible. 
                  Our pharmacists will review it within 24 hours.
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full" disabled={isUploading}>
                {isUploading ? 'Uploading...' : '📤 Upload Prescription'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Prescription History */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>📋 Your Prescriptions</CardTitle>
              <CardDescription>
                Track the status of your uploaded prescriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-gray-500 text-center py-4">Loading prescriptions...</p>
              ) : prescriptions.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl mb-2 block">💊</span>
                  <p className="text-gray-500">No prescriptions uploaded yet</p>
                  <p className="text-sm text-gray-400">Upload your first prescription to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((prescription: Prescription) => (
                    <div key={prescription.id} className="border rounded-md p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Dr. {prescription.doctor_name}</p>
                          <p className="text-sm text-gray-600">License: {prescription.doctor_license}</p>
                        </div>
                        <Badge className={getStatusColor(prescription.status)}>
                          {getStatusIcon(prescription.status)} {prescription.status.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <p>Prescription Date: {prescription.prescription_date.toLocaleDateString()}</p>
                        <p>Uploaded: {prescription.created_at.toLocaleDateString()}</p>
                      </div>
                      
                      {prescription.verification_notes && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Pharmacist Notes:</p>
                            <p className="text-sm text-gray-600">{prescription.verification_notes}</p>
                          </div>
                        </>
                      )}
                      
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm">
                          📱 View Image
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions Card */}
          <Card>
            <CardHeader>
              <CardTitle>📖 How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start space-x-3">
                <span className="text-lg">1️⃣</span>
                <div>
                  <p className="font-medium">Upload Prescription</p>
                  <p className="text-gray-600">Take a clear photo of your prescription</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-lg">2️⃣</span>
                <div>
                  <p className="font-medium">Verification</p>
                  <p className="text-gray-600">Our licensed pharmacists review it</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-lg">3️⃣</span>
                <div>
                  <p className="font-medium">Shop & Order</p>
                  <p className="text-gray-600">Add verified medicines to your cart</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
