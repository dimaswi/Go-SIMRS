import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { usersApi } from '@/lib/api';
import { User, Mail, Lock, Shield, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { setPageTitle } from '@/lib/page-title';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

export default function AccountPage() {
  const { user, setUser } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    setPageTitle('Account');
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Only send fields that are being updated
      const updateData = {
        full_name: formData.full_name,
        email: formData.email,
        username: user!.username,
        role_id: user!.role_id,
        is_active: user!.is_active,
      };

      await usersApi.update(user!.id, updateData);

      // Update only the changed fields, keep everything else from current user
      setUser({
        ...user!,
        full_name: formData.full_name,
        email: formData.email,
      });

      toast({
        variant: "success",
        title: "Success!",
        description: "Profile updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Failed to update profile.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.new_password !== formData.confirm_password) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "New password and confirmation do not match.",
      });
      return;
    }

    setLoading(true);
    try {
      // Assuming there's a change password endpoint
      await usersApi.update(user!.id, {
        ...user,
        password: formData.new_password,
      });

      toast({
        variant: "success",
        title: "Success!",
        description: "Password changed successfully.",
      });

      setFormData({
        ...formData,
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Failed to change password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={User}
        title="Account Settings"
        description="Manage your account information and security"
      />

      <PageContent>
        <div className="space-y-8">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Profile Information */}
            <section className="flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Profile Information</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Update your personal information</p>
                </div>
                <form id="profile-form" onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-xs font-medium flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      Full Name
                    </Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="h-9 rounded-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-medium flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-9 rounded-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      Role
                    </Label>
                    <div>
                      <Badge variant="outline" className="rounded-none font-normal">
                        {user?.role?.name || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </form>
              </div>

              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
                <Button
                  type="submit"
                  form="profile-form"
                  disabled={loading}
                  className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-4 text-xs font-semibold shadow-none"
                >
                  {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Update Profile
                </Button>
              </div>
            </section>

            {/* Change Password */}
            <section className="flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Change Password</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Update your password to keep your account secure</p>
                </div>
                <form id="password-form" onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_password" className="text-xs font-medium flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Current Password
                    </Label>
                    <Input
                      id="current_password"
                      type="password"
                      value={formData.current_password}
                      onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                      className="h-9 rounded-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new_password" className="text-xs font-medium flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      New Password
                    </Label>
                    <Input
                      id="new_password"
                      type="password"
                      value={formData.new_password}
                      onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                      className="h-9 rounded-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password" className="text-xs font-medium flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      className="h-9 rounded-none text-sm"
                    />
                  </div>
                </form>
              </div>

              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
                <Button
                  type="submit"
                  form="password-form"
                  disabled={loading}
                  className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-4 text-xs font-semibold shadow-none"
                >
                  {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Change Password
                </Button>
              </div>
            </section>
          </div>

          {/* Digital Signature PIN */}
          <section className="space-y-4">
            <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Tanda Tangan Digital</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Kelola PIN untuk tanda tangan dokumen digital</p>
            </div>
            <div>
              <Link
                to="/account/signature-pin"
                className="flex items-center justify-between py-3 px-2 rounded-none border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {user?.has_signature_pin ? 'Ubah PIN Tanda Tangan' : 'Atur PIN Tanda Tangan'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.has_signature_pin
                        ? 'PIN sudah diatur. Klik untuk mengubah.'
                        : 'Anda belum mengatur PIN. Klik untuk setup.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user?.has_signature_pin ? (
                    <Badge variant="default" className="rounded-none text-xs">Aktif</Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-none text-xs">Belum Diatur</Badge>
                  )}
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            </div>
          </section>
        </div>
      </PageContent>
    </PageShell>
  );
}
