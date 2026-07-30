import { ImageResponse } from 'next/og';

export const alt = 'SmartJib budget tracker for needs, wants, savings, and money places';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

const envelopeRows = [
  { label: 'Needs', value: '50%', width: '78%', color: '#00685f' },
  { label: 'Wants', value: '30%', width: '52%', color: '#4a938a' },
  { label: 'Savings', value: '20%', width: '34%', color: '#83c9bf' },
];

const moneyPlaces = [
  { label: 'Bank', amount: '8,400' },
  { label: 'Home', amount: '1,200' },
  { label: 'Wallet', amount: '400' },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: '#f4f8f6',
          color: '#121a18',
          fontFamily: 'Arial, sans-serif',
          padding: '64px 68px',
        }}
      >
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: 999,
            right: -130,
            top: -170,
            background: '#89f5e7',
            opacity: 0.55,
          }}
        />
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            width: 280,
            height: 280,
            borderRadius: 999,
            left: 390,
            bottom: -210,
            background: '#00685f',
            opacity: 0.12,
          }}
        />

        <div
          style={{
            width: '49%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingRight: 42,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 58,
                height: 58,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                background: '#00685f',
                color: '#ffffff',
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              S
            </div>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 750 }}>SmartJib</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                color: '#00685f',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1.5,
                marginBottom: 18,
                textTransform: 'uppercase',
              }}
            >
              Private budget tracker
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                fontSize: 54,
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: -2.2,
              }}
            >
              <span>Budget needs,</span>
              <span>wants &amp; savings.</span>
              <span style={{ color: '#58706a' }}>Track every place.</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, color: '#53645f', fontSize: 18 }}>
            <span>12 currencies</span>
            <span>•</span>
            <span>4 strategies</span>
            <span>•</span>
            <span>No bank connection</span>
          </div>
        </div>

        <div
          style={{
            width: '51%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 520,
              height: 484,
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              border: '2px solid #cedbd7',
              borderRadius: 30,
              padding: '30px 32px',
              boxShadow: '0 24px 60px rgba(18, 52, 47, 0.14)',
              transform: 'rotate(1.5deg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#687a75', fontSize: 15 }}>July budget</span>
                <span style={{ fontSize: 32, fontWeight: 750 }}>10,000 MAD</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  padding: '9px 14px',
                  borderRadius: 999,
                  background: '#e6f5f2',
                  color: '#00685f',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                50 / 30 / 20
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {envelopeRows.map((row) => (
                <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 16,
                      fontWeight: 650,
                    }}
                  >
                    <span>{row.label}</span>
                    <span>{row.value}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      height: 10,
                      width: '100%',
                      borderRadius: 999,
                      background: '#e9efed',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        width: row.width,
                        height: '100%',
                        borderRadius: 999,
                        background: row.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                marginTop: 27,
                paddingTop: 22,
                borderTop: '1px solid #dce5e2',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <span style={{ color: '#687a75', fontSize: 15 }}>Money places</span>
              <div style={{ display: 'flex', gap: 10 }}>
                {moneyPlaces.map((place) => (
                  <div
                    key={place.label}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 13,
                      background: '#f4f8f6',
                      padding: '12px 13px',
                    }}
                  >
                    <span style={{ color: '#687a75', fontSize: 13 }}>{place.label}</span>
                    <span style={{ fontSize: 17, fontWeight: 750 }}>{place.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
