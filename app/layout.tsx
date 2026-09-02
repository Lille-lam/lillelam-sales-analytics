import "./globals.css";
export const metadata = { title:"Lillelam Sales Analytics", description:"Live Odoo sales analytics for Lillelam" };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
