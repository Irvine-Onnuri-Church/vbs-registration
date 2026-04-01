import MyPageClient from './MyPageClient';

export default function MyPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <MyPageClient token={searchParams.token ?? null} />;
}
