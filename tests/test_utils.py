import unittest
from app.utils import format_temperature

class TestUtils(unittest.TestCase):
    """Tests for utility functions."""

    def test_format_temperature_positive(self):
        """Test formatting a positive temperature."""
        # Arrange
        temp = 25.5

        # Act
        formatted_temp = format_temperature(temp)

        # Assert
        self.assertEqual(formatted_temp, "25.5°C")

    def test_format_temperature_zero(self):
        """Test formatting a zero temperature."""
        # Arrange
        temp = 0

        # Act
        formatted_temp = format_temperature(temp)

        # Assert
        self.assertEqual(formatted_temp, "0°C")

    def test_format_temperature_negative(self):
        """Test formatting a negative temperature."""
        # Arrange
        temp = -10.2

        # Act
        formatted_temp = format_temperature(temp)

        # Assert
        self.assertEqual(formatted_temp, "-10.2°C")

if __name__ == '__main__':
    unittest.main()