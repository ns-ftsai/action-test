import unittest
from unittest.mock import patch, Mock
from app.weather import WeatherReporter
import requests

class TestWeatherReporter(unittest.TestCase):
    """Tests for the WeatherReporter class."""

    def setUp(self):
        """Set up a WeatherReporter instance for all tests."""
        self.reporter = WeatherReporter(api_key="test_api_key")

    @patch('app.weather.requests.get')
    def test_get_current_temperature_success(self, mock_get):
        """Test successfully getting the current temperature."""
        # Arrange
        mock_response = Mock()
        expected_temp = 22.5
        mock_response.json.return_value = {"main": {"temp": expected_temp}}
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        # Act
        temperature = self.reporter.get_current_temperature("London")

        # Assert
        self.assertEqual(temperature, expected_temp)
        mock_get.assert_called_once_with(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": "London", "appid": "test_api_key", "units": "metric"}
        )

    @patch('app.weather.requests.get')
    def test_get_current_temperature_api_error(self, mock_get):
        """Test handling of an API error (e.g., 404 Not Found)."""
        # Arrange
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("404 Client Error")
        mock_get.return_value = mock_response

        # Act
        temperature = self.reporter.get_current_temperature("InvalidCity")

        # Assert
        self.assertEqual(temperature, 0.0)
        mock_get.assert_called_once()

    @patch('app.weather.requests.get')
    def test_get_current_temperature_network_error(self, mock_get):
        """Test handling of a network error."""
        # Arrange
        mock_get.side_effect = requests.exceptions.ConnectionError

        # Act
        temperature = self.reporter.get_current_temperature("London")

        # Assert
        self.assertEqual(temperature, 0.0)
        mock_get.assert_called_once()

if __name__ == '__main__':
    unittest.main()