using System.IO;
using System.Threading.Tasks;

namespace LegalPro.Application.Common.Interfaces;

/// <summary>
/// Puerto para el almacenamiento de archivos (digitales, documentos de expedientes, etc.).
/// </summary>
public interface IStorageService
{
    Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType);
    Task<Stream> DownloadFileAsync(string fileUrl);
    Task<bool> DeleteFileAsync(string fileUrl);
}
