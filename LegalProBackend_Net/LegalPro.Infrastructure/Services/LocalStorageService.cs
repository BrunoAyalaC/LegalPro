using System;
using System.IO;
using System.Threading.Tasks;
using LegalPro.Application.Common.Interfaces;

namespace LegalPro.Infrastructure.Services;

public class LocalStorageService : IStorageService
{
    private readonly string _storageFolder;

    public LocalStorageService()
    {
        _storageFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        if (!Directory.Exists(_storageFolder))
        {
            Directory.CreateDirectory(_storageFolder);
        }
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType)
    {
        var uniqueFileName = $"{Guid.NewGuid()}_{fileName}";
        var filePath = Path.Combine(_storageFolder, uniqueFileName);

        using (var outputStream = new FileStream(filePath, FileMode.Create))
        {
            await fileStream.CopyToAsync(outputStream);
        }

        return $"/uploads/{uniqueFileName}";
    }

    public Task<Stream> DownloadFileAsync(string fileUrl)
    {
        var fileName = Path.GetFileName(fileUrl);
        var filePath = Path.Combine(_storageFolder, fileName);

        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("El archivo no existe en el almacenamiento local.", filePath);
        }

        Stream stream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        return Task.FromResult(stream);
    }

    public Task<bool> DeleteFileAsync(string fileUrl)
    {
        var fileName = Path.GetFileName(fileUrl);
        var filePath = Path.Combine(_storageFolder, fileName);

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }
}
