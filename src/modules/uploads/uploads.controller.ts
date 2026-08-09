import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { AllowlistGuard } from '../auth/allowlist.guard';

// Telegram's own sendPhoto/sendDocument limits are far higher, but files this large would
// blow past most bots' practical use case here (screenshots, small docs) and risk tying up
// the outbound queue for a long upload — keep it modest.
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(AllowlistGuard)
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  /** Section: agent-attached media for replies. Stores the file under ./uploads (mounted as a
   * Docker volume in prod — see infra repo) and hands back a URL Telegram's Bot API can fetch
   * directly for sendPhoto/sendDocument, since those accept a URL in place of re-uploading the
   * file's bytes through our own bot connection. */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded (expected form field "file")');
    const publicUrl = this.config.get<string>('publicUrl');
    return {
      fileId: file.filename,
      url: `${publicUrl}/uploads/${file.filename}`,
      mimeType: file.mimetype,
    };
  }
}
