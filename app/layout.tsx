export const metadata = {
  title: 'LIFT.OS',
  description: 'Treino, dieta e evolução — app pessoal de Jefferson',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
