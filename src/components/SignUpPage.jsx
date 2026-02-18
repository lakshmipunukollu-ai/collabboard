import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0f172a',
      padding: '24px',
      gap: '24px',
    }}>
      <SignUp 
        signInUrl="/sign-in"
        afterSignUpUrl="/"
        redirectUrl="/"
      />
      
      <div style={{
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '14px',
      }}>
        Already have an account?{' '}
        <a 
          href="/sign-in"
          style={{ 
            color: '#6366f1', 
            textDecoration: 'none',
            fontWeight: '600',
          }}
          onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
          onMouseOut={(e) => e.target.style.textDecoration = 'none'}
        >
          Sign in
        </a>
      </div>
    </div>
  );
}
