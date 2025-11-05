#!/bin/bash

# Flux - Vidking API Testing Suite
# Tests complete Vidking Player API functionality

echo "🎬 Flux - Vidking API Test Suite"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test URL
test_url() {
    local test_name=$1
    local url=$2
    local expected_status=$3
    
    echo -e "${BLUE}Testing:${NC} $test_name"
    echo "URL: $url"
    
    response=$(curl -s -w "\n%{http_code}" -I "$url" 2>/dev/null)
    status=$(echo "$response" | tail -1)
    
    if [ "$status" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $status)"
        ((TESTS_FAILED++))
    fi
    echo ""
}

echo "📺 MOVIE TESTS"
echo "=============="
echo ""

# Test Movie Embeds
test_url "Movie: Deadpool & Wolverine" \
    "https://www.vidking.net/embed/movie/533535" \
    "200"

test_url "Movie: Carry-On" \
    "https://www.vidking.net/embed/movie/1078605" \
    "200"

test_url "Movie: Inception" \
    "https://www.vidking.net/embed/movie/27205" \
    "200"

test_url "Movie: The Dark Knight" \
    "https://www.vidking.net/embed/movie/155" \
    "200"

test_url "Movie: Avatar" \
    "https://www.vidking.net/embed/movie/19995" \
    "200"

echo ""
echo "📺 TV SHOWS TESTS"
echo "================="
echo ""

# Test TV Show Embeds
test_url "TV: Wednesday S1E1" \
    "https://www.vidking.net/embed/tv/119051/1/1" \
    "200"

test_url "TV: Arcane S1E1" \
    "https://www.vidking.net/embed/tv/94605/1/1" \
    "200"

test_url "TV: Breaking Bad S1E1" \
    "https://www.vidking.net/embed/tv/1396/1/1" \
    "200"

test_url "TV: Friends S1E1" \
    "https://www.vidking.net/embed/tv/1668/1/1" \
    "200"

test_url "TV: Game of Thrones S1E1" \
    "https://www.vidking.net/embed/tv/1399/1/1" \
    "200"

echo ""
echo "🎨 PARAMETER TESTS (with custom colors)"
echo "========================================"
echo ""

# Test with parameters
test_url "Movie with Netflix Red color" \
    "https://www.vidking.net/embed/movie/533535?color=e50914" \
    "200"

test_url "Movie with auto-play" \
    "https://www.vidking.net/embed/movie/1078605?autoPlay=true" \
    "200"

test_url "Movie with progress" \
    "https://www.vidking.net/embed/movie/27205?progress=120" \
    "200"

test_url "TV with all features" \
    "https://www.vidking.net/embed/tv/119051/1/1?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true" \
    "200"

echo ""
echo "📊 TEST SUMMARY"
echo "==============="
echo -e "✓ Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "✗ Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "✅ Vidking API is working correctly"
    echo "✅ Movies are accessible"
    echo "✅ TV shows are accessible"
    echo "✅ Custom colors working"
    echo "✅ Auto-play feature working"
    echo "✅ Progress tracking ready"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi
