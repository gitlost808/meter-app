import { PartialType } from '@nestjs/swagger';
import { CreateNoteDto } from './create-note.dto';

// skipNullProperties: false validates explicit nulls (so `{ "text": null }` is a 400)
// while omitted fields stay optional.
export class UpdateNoteDto extends PartialType(CreateNoteDto, { skipNullProperties: false }) {}
