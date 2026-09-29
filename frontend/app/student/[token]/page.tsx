import { StudentView } from "@/components/student/student-view";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <StudentView token={token} />;
}
