import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileSettings {
  name: string;
  email: string;
  notifications: boolean;
  newsletter: boolean;
}

const STORAGE_KEYS = {
  avatar: "user_profile_avatar_dataurl",
  settings: "user_profile_settings",
};

export default function UserProfile() {
  const [settings, setSettings] = useState<ProfileSettings>({
    name: "",
    email: "",
    notifications: true,
    newsletter: false,
  });
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const initials = useMemo(() => {
    const parts = (settings.name || "").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "U";
  }, [settings.name]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      if (raw) {
        const parsed: ProfileSettings = JSON.parse(raw);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch {}
    const savedAvatar = localStorage.getItem(STORAGE_KEYS.avatar);
    if (savedAvatar) setAvatarDataUrl(savedAvatar);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (PNG/JPEG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAvatarDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
      if (avatarDataUrl) localStorage.setItem(STORAGE_KEYS.avatar, avatarDataUrl);
      // If integrating with backend, POST the avatar + settings here.
      // await api.saveProfile(settings, avatarFile)
      setTimeout(() => {
        setSaving(false);
        alert("Profile saved successfully.");
      }, 400);
    } catch (err) {
      setSaving(false);
      alert("Failed to save settings.");
    }
  };

  const resetAvatar = () => {
    setAvatarDataUrl(null);
    localStorage.removeItem(STORAGE_KEYS.avatar);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, settings, and avatar.</p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Basic details about you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {avatarDataUrl ? (
                  <AvatarImage src={avatarDataUrl} alt="Avatar" />
                ) : (
                  <AvatarFallback>{initials}</AvatarFallback>
                )}
              </Avatar>
              <div className="space-x-2">
                <Label htmlFor="avatar" className="sr-only">Upload avatar</Label>
                <Input id="avatar" type="file" accept="image/*" onChange={handleFileChange} />
                {avatarDataUrl && (
                  <Button type="button" variant="secondary" onClick={resetAvatar} className="mt-2">Remove</Button>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Ada Lovelace"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ada@example.com"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
          </CardFooter>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Personalise your experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-sm text-muted-foreground">Receive important updates about your tests and reports.</p>
              </div>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(v) => setSettings({ ...settings, notifications: v })}
                aria-label="Toggle notifications"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Monthly newsletter</p>
                <p className="text-sm text-muted-foreground">Product updates, tips, and insights delivered monthly.</p>
              </div>
              <Switch
                checked={settings.newsletter}
                onCheckedChange={(v) => setSettings({ ...settings, newsletter: v })}
                aria-label="Toggle newsletter"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
