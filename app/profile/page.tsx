"use client"

import { Badge } from "@/components/ui/badge"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertTriangle, Check, Edit, Smartphone, User } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"
import TOTPVerification from "@/components/totp-verification"
import QRCodeDisplay from "@/components/qr-code-display"

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  })
  const [showTOTP, setShowTOTP] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [securitySettings, setSecuritySettings] = useState({
    emailAlerts: true,
    smsAlerts: true,
    loginNotifications: true,
    transactionAlerts: true,
  })
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        setUser(user)

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("user_id", user.id)
          .single()

        if (profileError) throw profileError
        setProfile(profile)

        // Set form data
        setFormData({
          fullName: profile.full_name || user.user_metadata?.full_name || "",
          email: user.email || "",
          phoneNumber: profile.phone_number || user.user_metadata?.phone_number || "",
        })

        // Fetch active sessions
        const {
          data: { sessions },
        } = await supabase.auth.getSessions()
        setSessions(sessions || [])
      } catch (err: any) {
        setError(err.message || "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSaveProfile = async () => {
    try {
      setLoading(true)
      setError("")
      setSuccess("")

      // Update profile in database
      const { error: updateError } = await supabase
        .from("users")
        .update({
          full_name: formData.fullName,
          phone_number: formData.phoneNumber,
        })
        .eq("user_id", user.id)

      if (updateError) throw updateError

      // Update user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: formData.fullName,
          phone_number: formData.phoneNumber,
        },
      })

      if (authError) throw authError

      // Update email if changed
      if (formData.email !== user.email) {
        setShowTOTP(true)
      } else {
        setSuccess("Profile updated successfully")
        setEditMode(false)
      }
    } catch (err: any) {
      setError(err.message || "Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const handleTOTPVerified = async () => {
    try {
      setLoading(true)
      setShowTOTP(false)

      // Update email
      const { error } = await supabase.auth.updateUser({
        email: formData.email,
      })

      if (error) throw error

      setSuccess("Profile updated successfully. Please check your email to verify the new address.")
      setEditMode(false)
    } catch (err: any) {
      setError(err.message || "Failed to update email")
    } finally {
      setLoading(false)
    }
  }

  const handleSecuritySettingChange = (setting: string, value: boolean) => {
    setSecuritySettings({
      ...securitySettings,
      [setting]: value,
    })
  }

  const handleLogoutAllDevices = async () => {
    try {
      setLoading(true)
      setError("")

      // Show TOTP verification before proceeding
      setShowTOTP(true)
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setLoading(false)
    }
  }

  const handleLogoutAllDevicesConfirmed = async () => {
    try {
      setShowTOTP(false)

      // Sign out from all devices
      const { error } = await supabase.auth.signOut({ scope: "global" })
      if (error) throw error

      // Redirect to login
      router.push("/login")
    } catch (err: any) {
      setError(err.message || "Failed to sign out from all devices")
      setLoading(false)
    }
  }

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">Success</AlertTitle>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {showTOTP ? (
        <TOTPVerification userId={user?.id} onVerified={handleTOTPVerified} onCancel={() => setShowTOTP(false)} />
      ) : showQRCode ? (
        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>Scan this QR code with the IOB Authenticator app</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <QRCodeDisplay userId={user?.id} accountId={profile?.account_id} userName={formData.fullName} />
          </CardContent>
          <CardFooter>
            <Button onClick={() => setShowQRCode(false)} className="w-full">
              Close
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Manage your personal details</CardDescription>
                  </div>
                  <Button variant={editMode ? "outline" : "default"} onClick={() => setEditMode(!editMode)}>
                    {editMode ? (
                      "Cancel"
                    ) : (
                      <>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src="/placeholder.svg" />
                      <AvatarFallback className="text-2xl bg-blue-600 text-white">
                        {formData.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {editMode && (
                      <Button variant="outline" size="sm">
                        Change Photo
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label htmlFor="userId">User ID</Label>
                        <Input id="userId" value={user?.id || ""} disabled />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              {editMode && (
                <CardFooter className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Authentication</CardTitle>
                  <CardDescription>Manage your authentication methods</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-500">Secure your account with TOTP</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowQRCode(true)}>
                      Setup
                    </Button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Change Password</p>
                        <p className="text-sm text-gray-500">Update your password</p>
                      </div>
                    </div>
                    <Button variant="outline">Change</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage your notification preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Email Alerts</p>
                      <p className="text-sm text-gray-500">Receive alerts via email</p>
                    </div>
                    <Switch
                      checked={securitySettings.emailAlerts}
                      onCheckedChange={(checked) => handleSecuritySettingChange("emailAlerts", checked)}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">SMS Alerts</p>
                      <p className="text-sm text-gray-500">Receive alerts via SMS</p>
                    </div>
                    <Switch
                      checked={securitySettings.smsAlerts}
                      onCheckedChange={(checked) => handleSecuritySettingChange("smsAlerts", checked)}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Login Notifications</p>
                      <p className="text-sm text-gray-500">Get notified of new logins</p>
                    </div>
                    <Switch
                      checked={securitySettings.loginNotifications}
                      onCheckedChange={(checked) => handleSecuritySettingChange("loginNotifications", checked)}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Transaction Alerts</p>
                      <p className="text-sm text-gray-500">Get notified of new transactions</p>
                    </div>
                    <Switch
                      checked={securitySettings.transactionAlerts}
                      onCheckedChange={(checked) => handleSecuritySettingChange("transactionAlerts", checked)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full">Save Preferences</Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="devices">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>Manage your active sessions</CardDescription>
                  </div>
                  <Button variant="destructive" onClick={handleLogoutAllDevices}>
                    Sign Out All Devices
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessions.map((session, index) => (
                    <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {session.user_agent ? session.user_agent.split(" ")[0] : "Unknown Device"}
                        </p>
                        <p className="text-sm text-gray-500">
                          Last active: {new Date(session.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.current_session && (
                          <Badge className="bg-green-100 text-green-800 border-green-200">Current</Badge>
                        )}
                        <Button variant="outline" size="sm">
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
