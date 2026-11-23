//! The small message format the app and the terminal keeper use on their pipe.
//!
//! Every frame is a 4-byte length, one kind byte, then the body.
//! A JSON frame carries a request, a reply or an event.
//! A data frame carries terminal bytes for one pane: a 2-byte id length, the id, then the bytes.

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

/// Change this when the frames or requests change. A new number starts a new keeper beside the old one.
pub const PROTO: u32 = 1;
pub const JSON: u8 = 1;
pub const DATA: u8 = 2;
const MAX_FRAME: usize = 16 * 1024 * 1024;

pub fn pipe_name() -> String {
    let user: String = std::env::var("USERNAME")
        .unwrap_or_else(|_| "user".into())
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    format!(r"\\.\pipe\switchyard-keeper-v{PROTO}-{user}")
}

pub async fn read_frame<R: AsyncRead + Unpin>(r: &mut R) -> std::io::Result<(u8, Vec<u8>)> {
    let len = r.read_u32_le().await? as usize;
    if len == 0 || len > MAX_FRAME {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "bad frame length"));
    }
    let mut body = vec![0u8; len];
    r.read_exact(&mut body).await?;
    let kind = body.remove(0);
    Ok((kind, body))
}

pub async fn write_frame<W: AsyncWrite + Unpin>(w: &mut W, kind: u8, body: &[u8]) -> std::io::Result<()> {
    let mut out = Vec::with_capacity(body.len() + 5);
    out.extend_from_slice(&((body.len() + 1) as u32).to_le_bytes());
    out.push(kind);
    out.extend_from_slice(body);
    w.write_all(&out).await?;
    w.flush().await
}

pub fn data_body(id: &str, bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(bytes.len() + id.len() + 2);
    out.extend_from_slice(&(id.len() as u16).to_le_bytes());
    out.extend_from_slice(id.as_bytes());
    out.extend_from_slice(bytes);
    out
}

pub fn split_data(body: &[u8]) -> Option<(&str, &[u8])> {
    if body.len() < 2 {
        return None;
    }
    let n = u16::from_le_bytes([body[0], body[1]]) as usize;
    let id = std::str::from_utf8(body.get(2..2 + n)?).ok()?;
    Some((id, &body[2 + n..]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_body_round_trips() {
        let body = data_body("pane-1", b"hello\x1b[0m");
        let (id, bytes) = split_data(&body).unwrap();
        assert_eq!(id, "pane-1");
        assert_eq!(bytes, b"hello\x1b[0m");
    }

    #[test]
    fn short_data_is_rejected() {
        assert!(split_data(&[5, 0, b'a']).is_none());
        assert!(split_data(&[1]).is_none());
    }

    #[tokio::test]
    async fn frames_round_trip() {
        let (mut a, mut b) = tokio::io::duplex(1024);
        write_frame(&mut a, JSON, br#"{"op":"list"}"#).await.unwrap();
        write_frame(&mut a, DATA, &data_body("x", b"abc")).await.unwrap();
        let (k1, b1) = read_frame(&mut b).await.unwrap();
        let (k2, b2) = read_frame(&mut b).await.unwrap();
        assert_eq!((k1, b1.as_slice()), (JSON, br#"{"op":"list"}"#.as_slice()));
        assert_eq!(k2, DATA);
        assert_eq!(split_data(&b2).unwrap(), ("x", b"abc".as_slice()));
    }
}
