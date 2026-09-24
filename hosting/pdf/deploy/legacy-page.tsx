export const dynamic = "force-dynamic";
export function loader({ request }: { request: Request }) {
  return new Response(null, {
    status: 301,
    headers: { location: "https://pdf.inklura.fr/" + new URL(request.url).search },
  });
}
export default function Page() { return null; }
