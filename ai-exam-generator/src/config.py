"""
Configuration management cho hệ thống
"""
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from loguru import logger


class Config:
    """Quản lý cấu hình hệ thống"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config_path = config_path
        self.config = self._load_config()
        self._setup_openai()
        self._create_directories()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load config từ file JSON"""
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(
                f"Không tìm thấy file config: {self.config_path}\n"
                f"Hãy sao chép config.example.json thành config.json và điền thông tin"
            )
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        logger.info(f"Đã load config từ {self.config_path}")
        return config
    
    def _setup_openai(self):
        """Setup OpenAI API key"""
        api_key = self.config.get('openai', {}).get('api_key', '')
        
        if not api_key or api_key == 'your-openai-api-key-here':
            raise ValueError(
                "Chưa cấu hình OpenAI API key!\n"
                "Hãy mở file config.json và điền API key vào openai.api_key"
            )
        
        # Set biến môi trường cho OpenAI
        os.environ['OPENAI_API_KEY'] = api_key
        logger.info("Đã setup OpenAI API key")
    
    def _create_directories(self):
        """Tạo các thư mục cần thiết"""
        paths = self.config.get('paths', {})
        for path in paths.values():
            Path(path).mkdir(parents=True, exist_ok=True)
        logger.info("Đã tạo các thư mục cần thiết")
    
    def get(self, *keys, default=None):
        """Lấy giá trị config theo key path"""
        value = self.config
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key, default)
            else:
                return default
        return value
    
    @property
    def openai_model(self) -> str:
        return self.get('openai', 'model', default='gpt-4-turbo-preview')
    
    @property
    def openai_embedding_model(self) -> str:
        return self.get('openai', 'embedding_model', default='text-embedding-3-small')
    
    @property
    def temperature(self) -> float:
        return self.get('openai', 'temperature', default=0.7)
    
    @property
    def max_retries(self) -> int:
        return self.get('openai', 'max_retries', default=3)
    
    @property
    def chunk_size(self) -> int:
        return self.get('rag', 'chunk_size', default=1000)
    
    @property
    def chunk_overlap(self) -> int:
        return self.get('rag', 'chunk_overlap', default=200)
    
    @property
    def top_k(self) -> int:
        return self.get('rag', 'top_k_retrieval', default=5)
    
    @property
    def upload_dir(self) -> str:
        return self.get('paths', 'upload_dir', default='./uploads')
    
    @property
    def output_dir(self) -> str:
        return self.get('paths', 'output_dir', default='./outputs')
    
    @property
    def templates_dir(self) -> str:
        return self.get('paths', 'templates_dir', default='./templates')


# Global config instance
_config: Optional[Config] = None


def get_config(config_path: str = "config.json") -> Config:
    """Lấy config instance (singleton)"""
    global _config
    if _config is None:
        _config = Config(config_path)
    return _config
