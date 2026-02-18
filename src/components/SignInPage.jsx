import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
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
      <SignIn 
        signUpUrl="/sign-up"
        afterSignInUrl="/"
        redirectUrl="/"
      />
      
      <div style={{
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '14px',
      }}>
        Don't have an account?{' '}
        <a 
          href="/sign-up"
          style={{ 
            color: '#6366f1', 
            textDecoration: 'none',
            fontWeight: '600',
          }}
          onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
          onMouseOut={(e) => e.target.style.textDecoration = 'none'}
        >
          Sign up
        </a>
      </div>
    </div>
  );
}
