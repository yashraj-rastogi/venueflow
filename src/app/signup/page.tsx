'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, Building2, CheckCircle2, Loader2, Mail, MapPin, Shield, Users, Zap } from 'lucide-react';
import type { PlanTier } from '@/types';

/**
 * /signup
 *
 * Self-service Organization & Venue onboarding wizard for VenueFlow SaaS.
 * 3-Step Flow:
 *   Step 1: Create Organization (name, slug, owner Email, plan selection)
 *   Step 2: Add Primary Venue (name, city, capacity)
 *   Step 3: Invite On-Duty Staff (list of emails)
 */
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [orgData, setOrgData] = useState({
    name      : '',
    slug      : '',
    ownerEmail: '',
    plan      : 'pro' as PlanTier,
  });

  const [venueData, setVenueData] = useState({
    name    : '',
    city    : '',
    capacity: 25000,
  });

  const [staffEmails, setStaffEmails] = useState<string[]>(['']);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Auto-generate slug from name
  const handleOrgNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setOrgData(prev => ({ ...prev, name, slug }));
  };

  const handleStaffEmailChange = (idx: number, val: string) => {
    setStaffEmails(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const addStaffRow = () => setStaffEmails(prev => [...prev, '']);
  const removeStaffRow = (idx: number) => setStaffEmails(prev => prev.filter((_, i) => i !== idx));

  // Submit complete onboarding payload
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const venueId = venueData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'main-stadium';

      const payload = {
        orgId: orgData.slug || `org-${Date.now()}`,
        name : orgData.name,
        slug : orgData.slug,
        ownerEmail: orgData.ownerEmail,
        plan: orgData.plan,
        venueId,
        venueName: venueData.name,
        city: venueData.city,
        capacity: Number(venueData.capacity),
        staffEmails: staffEmails.filter(e => e.trim().length > 0),
      };

      const res = await fetch('/api/admin/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      // Redirect to newly created admin dashboard
      router.push(`/org/${payload.orgId}/venue/${venueId}/admin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      
      {/* Top Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '2rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={20} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>VenueFlow SaaS</span>
      </div>

      <main className="card" style={{ width: '100%', maxWidth: 540, borderRadius: 16, padding: '2rem', border: '1px solid var(--border)' }}>
        
        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', position: 'relative' }}>
          {[
            { num: 1, label: 'Organization' },
            { num: 2, label: 'Primary Venue' },
            { num: 3, label: 'Team & Staff' },
          ].map(s => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step >= s.num ? 1 : 0.4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= s.num ? 'var(--brand)' : 'var(--surface-2)', color: step >= s.num ? '#fff' : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700 }}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.5rem', color: 'var(--danger)', fontSize: '0.8125rem' }}>
            {error}
          </div>
        )}

        {/* STEP 1: ORGANIZATION */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 1: Create Organization</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>Setup your company or facility operating entity.</p>
            </div>

            <div>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Organization Name</label>
              <input
                className="input-dark"
                value={orgData.name}
                onChange={e => handleOrgNameChange(e.target.value)}
                placeholder="e.g. ITPO India / Metropolitan Sports Authority"
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Organization Slug</label>
              <input
                className="input-dark"
                value={orgData.slug}
                onChange={e => setOrgData(p => ({ ...p, slug: e.target.value }))}
                placeholder="url-friendly-slug"
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Admin / Owner Email</label>
              <input
                type="email"
                className="input-dark"
                value={orgData.ownerEmail}
                onChange={e => setOrgData(p => ({ ...p, ownerEmail: e.target.value }))}
                placeholder="admin@venue.com"
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>SaaS Plan Tier</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {(['starter', 'pro', 'enterprise'] as const).map(tier => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setOrgData(p => ({ ...p, plan: tier }))}
                    style={{
                      background: orgData.plan === tier ? 'color-mix(in srgb, var(--brand) 12%, var(--surface-2))' : 'var(--surface-2)',
                      border: `1px solid ${orgData.plan === tier ? 'var(--brand)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: '0.75rem 0.5rem',
                      color: orgData.plan === tier ? 'var(--brand-light)' : 'var(--text-2)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (!orgData.name || !orgData.ownerEmail) return setError('Please fill in all required fields');
                setError('');
                setStep(2);
              }}
              className="btn-glow"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
            >
              Continue to Primary Venue <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* STEP 2: PRIMARY VENUE */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 2: Add Primary Venue</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>Configure the first stadium, arena, or complex under {orgData.name}.</p>
            </div>

            <div>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Venue / Complex Name</label>
              <input
                className="input-dark"
                value={venueData.name}
                onChange={e => setVenueData(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Bharat Mandap / MetLife Stadium"
                style={{ width: '100%' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>City</label>
                <input
                  className="input-dark"
                  value={venueData.city}
                  onChange={e => setVenueData(p => ({ ...p, city: e.target.value }))}
                  placeholder="New Delhi / East Rutherford"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Total Guest Capacity</label>
                <input
                  type="number"
                  className="input-dark"
                  value={venueData.capacity}
                  onChange={e => setVenueData(p => ({ ...p, capacity: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setStep(1)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                Back
              </button>
              <button
                onClick={() => {
                  if (!venueData.name || !venueData.city) return setError('Please fill in venue details');
                  setError('');
                  setStep(3);
                }}
                className="btn-glow"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                Continue to Staff Invitations <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: STAFF INVITATIONS */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 3: Invite On-Duty Staff</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>Add team members who will monitor crowd telemetry or respond to alerts.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="label-xs">Staff Member Emails</label>
              {staffEmails.map((email, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="email"
                    className="input-dark"
                    value={email}
                    onChange={e => handleStaffEmailChange(idx, e.target.value)}
                    placeholder="staff@venue.com"
                    style={{ flex: 1 }}
                  />
                  {staffEmails.length > 1 && (
                    <button type="button" onClick={() => removeStaffRow(idx)} className="btn-ghost" style={{ color: 'var(--danger)', padding: '0 0.75rem' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addStaffRow} className="btn-ghost" style={{ alignSelf: 'flex-start', fontSize: '0.75rem', marginTop: 4 }}>
                + Add another staff email
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setStep(2)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-glow"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Complete Setup & Launch 🚀'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
