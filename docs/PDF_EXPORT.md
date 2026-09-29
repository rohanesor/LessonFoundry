# PDF Export and Private Delivery

LessonFoundry exports only current, approved asset versions through the existing
DB-polling worker. `ReportLabRenderer` is used because it is portable in the
existing Python slim container and does not require browser or OS rendering
dependencies. The renderer is behind the `PDFRenderer` protocol and can be
replaced later without changing the export job or storage path.

## Flow

1. Teacher publishes an approved classroom pack.
2. The API creates an `exports` record (`queued`) and an `export` job.
3. Worker changes the export to `processing`, renders approved content, uploads
   `exports/{unit_id}/{export_id}.pdf`, then records `completed`, MIME type,
   and file size.
4. On render/upload failure the export is marked `failed` with a safe generic
   error; credentials and storage provider responses are not stored.

`S3ObjectStore` uses the AWS SDK default credential chain. On EC2, attach a
least-privilege IAM instance role; do not provide long-lived access keys.
Objects receive `Content-Type: application/pdf`, server-side AES256 encryption,
and no public ACL. Presigned URLs expire after 300 seconds.

## Deployment

`reportlab` is a Python dependency and needs no additional apt packages for the
text/flowchart PDF layout used here. Rebuild the backend image after updating
`backend/requirements.txt`, then apply migration 009 after migrations 001–008.

## Authorization

- Teacher download: pack owner and latest completed export only.
- Student download: active classroom membership, published pack, and completed
  export only.
- Legacy anonymous share tokens do not receive the new export endpoint.
