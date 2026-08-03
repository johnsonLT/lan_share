import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:intl/intl.dart';

void main() {
  runApp(const LanShareApp());
}

class LanShareApp extends StatelessWidget {
  const LanShareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LanShare',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F1115),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF3B82F6),
          secondary: Color(0xFF60A5FA),
          surface: Color(0xFF1E222A),
          background: Color(0xFF0F1115),
          onSurface: Color(0xFFF0F2F5),
        ),
        textTheme: const TextTheme(
          headlineLarge: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w700,
            color: Color(0xFFF0F2F5),
          ),
          titleLarge: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: Color(0xFFF0F2F5),
          ),
          bodyLarge: TextStyle(
            fontSize: 16,
            color: Color(0xFFF0F2F5),
          ),
          bodyMedium: TextStyle(
            fontSize: 14,
            color: Color(0xFF8B93A7),
          ),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1E222A).withOpacity(0.9),
          elevation: 8,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1E222A),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0x33FFFFFF)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0x33FFFFFF)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF3B82F6)),
          ),
          labelStyle: const TextStyle(color: Color(0xFF8B93A7)),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF3B82F6),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
      home: const ConnectScreen(),
    );
  }
}

class Prefs {
  static const String _ipHistoryKey = 'ip_history';
  static const String _storageFolderKey = 'storage_folder';
  static const String _clientIdKey = 'client_id';

  static Future<List<String>> getIpHistory() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_ipHistoryKey) ?? [];
  }

  static Future<void> addIpToHistory(String ip) async {
    final prefs = await SharedPreferences.getInstance();
    final history = prefs.getStringList(_ipHistoryKey) ?? [];
    history.remove(ip);
    history.insert(0, ip);
    if (history.length > 20) history.removeLast();
    await prefs.setStringList(_ipHistoryKey, history);
  }

  static Future<void> clearIpHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_ipHistoryKey);
  }

  static Future<String?> getStorageFolder() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_storageFolderKey);
  }

  static Future<void> setStorageFolder(String path) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageFolderKey, path);
  }

  static Future<String> getClientId() async {
    final prefs = await SharedPreferences.getInstance();
    String? id = prefs.getString(_clientIdKey);
    if (id == null || id.isEmpty) {
      id = '${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(9999)}';
      await prefs.setString(_clientIdKey, id);
    }
    return id;
  }
}

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _ipController = TextEditingController();
  final _portController = TextEditingController(text: '34345');
  bool _isLoading = false;
  String? _error;
  List<String> _ipHistory = [];

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final history = await Prefs.getIpHistory();
    setState(() => _ipHistory = history);
  }

  Future<void> _connect() async {
    final ip = _ipController.text.trim();
    final port = _portController.text.trim();

    if (ip.isEmpty) {
      setState(() => _error = '请输入服务器 IP 地址');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final dio = Dio(BaseOptions(connectTimeout: const Duration(seconds: 5)));
      final response = await dio.get('http://$ip:$port/api/status');

      if (response.data['success'] == true) {
        await Prefs.addIpToHistory(ip);
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => FileListScreen(serverIp: ip, port: port),
          ),
        );
      } else {
        setState(() => _error = '服务器响应异常');
      }
    } catch (e) {
      setState(() => _error = '连接失败，请检查 IP、端口和网络');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _clearHistory() async {
    await Prefs.clearIpHistory();
    setState(() => _ipHistory = []);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 60),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: const Icon(Icons.swap_horiz, color: Colors.white, size: 32),
              ),
              const SizedBox(height: 28),
              Text(
                'LanShare',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 8),
              const Text(
                '局域网文件互传',
                style: TextStyle(
                  fontSize: 18,
                  color: Color(0xFF8B93A7),
                ),
              ),
              const SizedBox(height: 48),
              TextField(
                controller: _ipController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: '服务器 IP 地址',
                  hintText: '例如 192.168.1.5',
                  prefixIcon: const Icon(Icons.computer, color: Color(0xFF8B93A7)),
                  suffixIcon: _ipHistory.isNotEmpty
                      ? PopupMenuButton<String>(
                          icon: const Icon(Icons.history, color: Color(0xFF8B93A7)),
                          tooltip: '历史 IP',
                          onSelected: (value) => _ipController.text = value,
                          itemBuilder: (context) => [
                            ..._ipHistory.map((ip) => PopupMenuItem(
                                  value: ip,
                                  child: Text(ip),
                                )),
                            const PopupMenuItem(
                              value: '__clear__',
                              child: Text('清空历史', style: TextStyle(color: Color(0xFFEF4444))),
                            ),
                          ],
                        )
                      : null,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _portController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: '端口号',
                  prefixIcon: Icon(Icons.settings_ethernet, color: Color(0xFF8B93A7)),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFFEF4444), fontSize: 14),
                ),
              ],
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _connect,
                  child: _isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Text('连接服务器'),
                ),
              ),
              if (_ipHistory.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Wrap(
                    spacing: 8,
                    children: _ipHistory.take(5).map((ip) {
                      return ActionChip(
                        label: Text(ip),
                        backgroundColor: const Color(0xFF1E222A),
                        side: const BorderSide(color: Color(0x33FFFFFF)),
                        onPressed: () => _ipController.text = ip,
                      );
                    }).toList(),
                  ),
                ),
              const Spacer(),
              if (_ipHistory.isNotEmpty)
                Center(
                  child: TextButton(
                    onPressed: _clearHistory,
                    child: const Text(
                      '清空历史记录',
                      style: TextStyle(color: Color(0xFF8B93A7)),
                    ),
                  ),
                ),
              const Center(
                child: Text(
                  '默认端口 34345',
                  style: TextStyle(color: Color(0xFF8B93A7), fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class FileListScreen extends StatefulWidget {
  final String serverIp;
  final String port;

  const FileListScreen({super.key, required this.serverIp, required this.port});

  @override
  State<FileListScreen> createState() => _FileListScreenState();
}

class _FileListScreenState extends State<FileListScreen> {
  final Dio _dio = Dio();
  List<dynamic> _files = [];
  bool _isLoading = true;
  bool _isUploading = false;
  String _status = '';
  String? _storageFolder;
  io.Socket? _socket;

  String get baseUrl => 'http://${widget.serverIp}:${widget.port}';

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await _requestPermissions();
    await _loadStorageFolder();
    await _loadFiles();
    _connectSocket();
  }

  void _connectSocket() async {
    try {
      final clientId = await Prefs.getClientId();
      _socket = io.io(baseUrl, <String, dynamic>{
        'transports': ['websocket'],
        'autoConnect': true,
      });

      _socket!.onConnect((_) {
        _socket!.emit('register', {
          'clientId': clientId,
          'name': 'Android 手机',
          'platform': 'android',
        });
      });

      _socket!.on('push_file', (data) async {
        final fileName = data['name']?.toString() ?? '';
        if (fileName.isNotEmpty) {
          setState(() => _status = '收到服务器推送: $fileName');
          await _downloadFile(fileName, data['size'] ?? 0);
        }
      });

      _socket!.onDisconnect((_) {
        setState(() => _status = '与服务器的实时连接已断开');
      });
    } catch (e) {
      setState(() => _status = 'Socket 连接失败: $e');
    }
  }

  @override
  void dispose() {
    _socket?.dispose();
    super.dispose();
  }

  Future<void> _requestPermissions() async {
    if (Platform.isAndroid) {
      await Permission.storage.request();
      await Permission.manageExternalStorage.request();
    }
  }

  Future<void> _loadStorageFolder() async {
    final folder = await Prefs.getStorageFolder();
    if (folder != null) {
      setState(() => _storageFolder = folder);
    } else {
      final downloads = await getDownloadsDirectory();
      final defaultFolder = Directory('${downloads?.path ?? '/storage/emulated/0/Download'}/LanShare');
      if (!defaultFolder.existsSync()) defaultFolder.createSync(recursive: true);
      await Prefs.setStorageFolder(defaultFolder.path);
      setState(() => _storageFolder = defaultFolder.path);
    }
  }

  Future<void> _selectStorageFolder() async {
    String? selected = await FilePicker.platform.getDirectoryPath(
      dialogTitle: '选择文件保存目录',
    );
    if (selected != null) {
      await Prefs.setStorageFolder(selected);
      setState(() => _storageFolder = selected);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('保存目录已设置为: $selected')),
        );
      }
    }
  }

  Future<void> _loadFiles() async {
    setState(() => _isLoading = true);
    try {
      final response = await _dio.get('$baseUrl/api/files');
      setState(() {
        _files = response.data['files'] ?? [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _status = '加载失败: $e';
      });
    }
  }

  Future<void> _pickAndUploadFiles() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        allowMultiple: true,
        type: FileType.any,
      );

      if (result == null || result.files.isEmpty) return;

      setState(() {
        _isUploading = true;
        _status = '正在上传 ${result.files.length} 个文件...';
      });

      final formData = FormData();
      for (var file in result.files) {
        if (file.path != null) {
          formData.files.add(
            MapEntry(
              'files',
              await MultipartFile.fromFile(
                file.path!,
                filename: file.name,
              ),
            ),
          );
        }
      }

      final response = await _dio.post(
        '$baseUrl/api/upload',
        data: formData,
        onSendProgress: (sent, total) {
          final percent = total > 0 ? (sent / total * 100).toStringAsFixed(1) : '0';
          setState(() => _status = '上传中 $percent%');
        },
      );

      if (response.data['success'] == true) {
        setState(() => _status = '上传成功');
        await _loadFiles();
      } else {
        setState(() => _status = '上传失败');
      }
    } catch (e) {
      setState(() => _status = '上传出错: $e');
    } finally {
      setState(() => _isUploading = false);
    }
  }

  Future<void> _downloadFile(String fileName, int size) async {
    try {
      if (_storageFolder == null) {
        setState(() => _status = '请先设置保存目录');
        return;
      }
      final folder = Directory(_storageFolder!);
      if (!folder.existsSync()) folder.createSync(recursive: true);

      final savePath = '${folder.path}/$fileName';
      setState(() => _status = '正在下载 $fileName...');

      await _dio.download(
        '$baseUrl/api/download/${Uri.encodeComponent(fileName)}',
        savePath,
        onReceiveProgress: (received, total) {
          if (total > 0) {
            final percent = (received / total * 100).toStringAsFixed(1);
            setState(() => _status = '下载中 $percent%');
          }
        },
      );

      setState(() => _status = '已保存到: $savePath');
    } catch (e) {
      setState(() => _status = '下载失败: $e');
    }
  }

  Future<void> _deleteFile(String fileName) async {
    try {
      await _dio.delete('$baseUrl/api/files/${Uri.encodeComponent(fileName)}');
      setState(() => _status = '已删除');
      await _loadFiles();
    } catch (e) {
      setState(() => _status = '删除失败: $e');
    }
  }

  String _formatSize(dynamic bytes) {
    final b = bytes is int ? bytes : int.tryParse(bytes.toString()) ?? 0;
    if (b == 0) return '0 B';
    const k = 1024;
    final sizes = ['B', 'KB', 'MB', 'GB'];
    final idx = (log(b) / log(k)).floor().clamp(0, sizes.length - 1);
    return '${(b / pow(k, idx)).toStringAsFixed(2)} ${sizes[idx]}';
  }

  String _formatDate(int timestamp) {
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
    return DateFormat('MM月dd日 HH:mm').format(date);
  }

  IconData _fileIcon(String name) {
    final ext = name.split('.').last.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext)) return Icons.image;
    if (['mp4', 'mov', 'avi', 'mkv'].contains(ext)) return Icons.movie;
    if (['mp3', 'wav', 'flac'].contains(ext)) return Icons.music_note;
    if (['pdf'].contains(ext)) return Icons.picture_as_pdf;
    if (['doc', 'docx'].contains(ext)) return Icons.description;
    if (['xls', 'xlsx'].contains(ext)) return Icons.table_chart;
    if (['zip', 'rar', '7z'].contains(ext)) return Icons.folder_zip;
    return Icons.insert_drive_file;
  }

  void _showStorageInfo() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E222A),
        title: const Text('文件接收地址'),
        content: Text(_storageFolder ?? '未设置'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('关闭'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _selectStorageFolder();
            },
            child: const Text('更改'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                      ),
                    ),
                    child: const Icon(Icons.swap_horiz, color: Colors.white),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'LanShare',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFF0F2F5),
                          ),
                        ),
                        Text(
                          '${widget.serverIp}:${widget.port}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF8B93A7),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.folder, color: Color(0xFF8B93A7)),
                    tooltip: '接收目录',
                    onPressed: _showStorageInfo,
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh, color: Color(0xFF8B93A7)),
                    onPressed: _loadFiles,
                  ),
                ],
              ),
            ),
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFF3B82F6)),
                    )
                  : _files.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.folder_open, size: 64, color: Color(0xFF3B3F4B)),
                              SizedBox(height: 16),
                              Text(
                                '暂无共享文件',
                                style: TextStyle(color: Color(0xFF8B93A7)),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          color: const Color(0xFF3B82F6),
                          backgroundColor: const Color(0xFF1E222A),
                          onRefresh: _loadFiles,
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _files.length,
                            itemBuilder: (context, index) {
                              final file = _files[index];
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Card(
                                  child: ListTile(
                                    leading: Container(
                                      width: 46,
                                      height: 46,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF3B82F6).withOpacity(0.12),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Icon(
                                        _fileIcon(file['name']),
                                        color: const Color(0xFF60A5FA),
                                      ),
                                    ),
                                    title: Text(
                                      file['name'],
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.w500),
                                    ),
                                    subtitle: Text(
                                      '${file['sizeText']} · ${_formatDate(file['modified'])}',
                                      style: const TextStyle(color: Color(0xFF8B93A7)),
                                    ),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.download, color: Color(0xFF3B82F6)),
                                          onPressed: () => _downloadFile(file['name'], file['size']),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.delete, color: Color(0xFF8B93A7)),
                                          onPressed: () => _deleteFile(file['name']),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
            ),
            if (_status.isNotEmpty || _isUploading)
              Container(
                width: double.infinity,
                color: const Color(0xFF1E222A),
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                child: Row(
                  children: [
                    if (_isUploading)
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF3B82F6),
                        ),
                      ),
                    if (_isUploading) const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _status,
                        style: const TextStyle(color: Color(0xFF8B93A7), fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isUploading ? null : _pickAndUploadFiles,
                  icon: const Icon(Icons.upload_file),
                  label: const Text('选择文件上传'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
