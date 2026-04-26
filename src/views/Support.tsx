import { Mail, MapPin, Briefcase } from 'lucide-react';

export default function Support() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px 16px 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', padding: '0 8px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px' }}>Support & About</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Get help and contact information</p>
      </div>

      {/* Developer Card */}
      <div style={{
        background: 'var(--bg-card)',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '24px',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2E5BFF 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            TS
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 12px' }}>Thansit Srisombut</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px', lineHeight: '1.5' }}>
              Page Support Developer
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="mailto:tsrisombut@gmail.com"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  border: '1px solid var(--border)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(46, 91, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#2E5BFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-main)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <Mail size={16} style={{ color: '#2E5BFF', flexShrink: 0 }} />
                <span>tsrisombut@gmail.com</span>
              </a>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px',
                borderRadius: '8px',
                background: 'var(--bg-main)',
                fontSize: '13px',
                fontWeight: '500',
                border: '1px solid var(--border)'
              }}>
                <Briefcase size={16} style={{ color: '#2E5BFF', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}>Department</div>
                  <div>Department of Ophthalmology</div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px',
                borderRadius: '8px',
                background: 'var(--bg-main)',
                fontSize: '13px',
                fontWeight: '500',
                border: '1px solid var(--border)'
              }}>
                <MapPin size={16} style={{ color: '#2E5BFF', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}>Location</div>
                  <div>Faculty of Medicine, Ramathibodi Hospital</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About App */}
      <div style={{
        background: 'var(--bg-card)',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '24px',
        border: '1px solid var(--border)'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 12px' }}>About EyeRAMAShift</h3>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '13px',
          margin: '0 0 12px',
          lineHeight: '1.6'
        }}>
          EyeRAMAShift is a comprehensive shift scheduling application designed for the Department of Ophthalmology at Ramathibodi Hospital. It helps manage doctor schedules, track workload distribution, and maintain shift assignments efficiently.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginTop: '16px'
        }}>
          <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>VERSION</div>
            <div style={{ fontSize: '14px', fontWeight: '700' }}>1.0.0</div>
          </div>
          <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>STATUS</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#00B27A' }}>Active</div>
          </div>
        </div>
      </div>

      {/* Quick Help */}
      <div style={{
        background: 'rgba(46, 91, 255, 0.08)',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid rgba(46, 91, 255, 0.2)',
        color: 'var(--text-main)'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 12px', color: '#2E5BFF' }}>Need Help?</h3>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '13px',
          margin: '0 0 12px',
          lineHeight: '1.6'
        }}>
          For support or questions about using EyeRAMAShift, please contact the Page Support Developer using the email provided above.
        </p>
        <a
          href="mailto:tsrisombut@gmail.com"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: '#2E5BFF',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Mail size={14} />
          Contact Support
        </a>
      </div>
    </div>
  );
}
