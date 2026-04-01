import MyPageClient from './MyPageClient';

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <MyPageClient token={token ?? null} />;
}
