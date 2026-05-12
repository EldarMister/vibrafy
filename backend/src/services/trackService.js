import {
  activateStoredTrack,
  createProcessingTrack,
  findDuplicateTrack,
  markTrackFailed,
  updateTrackMetadata,
} from "../repositories/tracksRepository.js";
import { normalizeParsedTrack } from "../utils/normalizeTrack.js";
import { saveRemoteFile } from "./storageService.js";

function isStorageUrl(url) {
  return String(url || "").startsWith("/uploads/");
}

async function saveCoverSafely(track, dbTrackId) {
  if (!track.cover_source_url) {
    return null;
  }

  try {
    return await saveRemoteFile({
      url: track.cover_source_url,
      type: "cover",
      trackId: dbTrackId,
    });
  } catch {
    return null;
  }
}

export async function importParsedTracks(db, parsedTracks) {
  const imported = [];

  for (const rawTrack of parsedTracks) {
    const track = normalizeParsedTrack(rawTrack);

    if (!track.title || !track.artist || !track.audio_source_url) {
      continue;
    }

    let dbTrack = null;

    try {
      const duplicate = await findDuplicateTrack(db, track);

      if (duplicate) {
        dbTrack = await updateTrackMetadata(db, duplicate.id, track, {
          markProcessing: !isStorageUrl(duplicate.audioUrl),
        });

        if (duplicate.status === "active" && isStorageUrl(duplicate.audioUrl)) {
          imported.push(dbTrack);
          continue;
        }
      } else {
        dbTrack = await createProcessingTrack(db, track);
      }

      const audioFile = await saveRemoteFile({
        url: track.audio_source_url,
        type: "audio",
        trackId: dbTrack.id,
      });
      const coverFile = await saveCoverSafely(track, dbTrack.id);

      const activeTrack = await activateStoredTrack(db, dbTrack.id, {
        audioUrl: audioFile.publicUrl,
        coverUrl: coverFile?.publicUrl || track.cover_source_url || dbTrack.coverUrl,
        audioHash: audioFile.hash,
        fileSize: audioFile.fileSize,
        audioStoragePath: audioFile.storagePath,
        coverStoragePath: coverFile?.storagePath || null,
        storageProvider: "local",
      });

      imported.push(activeTrack);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown import error";

      if (dbTrack?.id) {
        await markTrackFailed(db, dbTrack.id, message);
      }
    }
  }

  return imported;
}
