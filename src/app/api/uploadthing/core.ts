import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'
import { api } from '../../../../convex/_generated/api'
import { fetchQuery } from 'convex/nextjs'
import { getToken } from '@convex-dev/better-auth/nextjs'
import { createAuth } from '../../../../convex/auth'

const f = createUploadthing()

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({ image: { maxFileSize: '4MB' } })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      const token = await getToken(createAuth)
      const user = await fetchQuery(api.auth.getCurrentUser, {}, { token })
      // If you throw, the user will not be able to upload
      if (!user?.userId) throw new UploadThingError('Unauthorized')

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: user.userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload
      console.log('Upload complete for userId:', metadata.userId)

      // !!! Whatever is returned here is sent to the client on a successful upload
      // !!! DO NOT RETURN SENSITIVE DATA (e.g. user IDs)
      return { uploadedBy: metadata.userId, url: file.ufsUrl }
    }),
  pdfUploader: f({ pdf: { maxFileSize: '16MB' } })
    .middleware(async ({ req }) => {
      const token = await getToken(createAuth)
      const user = await fetchQuery(api.auth.getCurrentUser, {}, { token })
      if (!user?.userId) throw new UploadThingError('Unauthorized')
      return { userId: user.userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl }
    }),
  // Unified uploader for both images and PDFs
  fileUploader: f({
    image: { maxFileSize: '4MB' },
    pdf: { maxFileSize: '16MB' },
  })
    .middleware(async ({ req }) => {
      const token = await getToken(createAuth)
      const user = await fetchQuery(api.auth.getCurrentUser, {}, { token })
      if (!user?.userId) throw new UploadThingError('Unauthorized')
      return { userId: user.userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
